/**
 * 日本銀行 時系列統計データ検索サイト API アダプタ (#228 #338、ADR-0012)。
 * **8 つ目のデータソース。**
 *
 * 日銀短観 (`db=CO`) と企業向けサービス価格指数 (`db=PR02`) を取る。どちらも
 * e-Stat・統計ダッシュボードには無い (日銀は政府統計ではないため)。
 *
 * **キー不要。** `getMetadata` で系列コードと系列名の対応表を、`getDataCode` で
 * 実際の時系列を取る。存在しない系列コードを渡すと明示的に `400` エラーになるため、
 * 系列が改廃されれば気づける。念のため `getDataCode` が返す系列名も期待値と突き合わせる。
 *
 * **クレジット表示が必須** (`api_notice.pdf`)。「このサービスは、日本銀行時系列統計
 * データ検索サイトの API 機能を使用しています。サービスの内容は日本銀行によって
 * 保証されたものではありません。」を `/terms` に掲載する。
 *
 * 日付は DB ごとに 6 桁の数値 `YYYY` + 2 桁の期間番号:
 * - `db=CO` (短観、四半期): 末尾 2 桁は四半期番号 `01`〜`04` (例: `202602` = 2026年Q2)
 * - `db=PR02` (SPPI、月次): 末尾 2 桁は月 `01`〜`12` (例: `202607` = 2026年7月)
 *
 * 統計ダッシュボード (`YYYYMM00`)・e-Stat 統計 API (`YYYY00MMMM`) とは異なる 3 つ目の
 * 日付形式。他形式を渡すと `null` を返す関数として分けている (#160 と同型の罠)。
 */
import type { Observations } from './fred';

const BASE_URL = 'https://www.stat-search.boj.or.jp/api/v1/getDataCode';

export type BojDb = 'CO' | 'PR02';

export interface BojQuery {
  db: BojDb;
  code: string;
  /** `getMetadata` で確認した日本語系列名。名前が変わったら気づけるよう突き合わせる。 */
  expectedName: string;
}

export function bojDataUrl(query: BojQuery): string {
  const params = new URLSearchParams({
    db: query.db,
    code: query.code,
    format: 'json',
    lang: 'jp',
  });
  return `${BASE_URL}?${params.toString()}`;
}

/** 四半期の `YYYYQQ` (QQ=01〜04) をその期の最終月に直す (#226 と同じ規約)。 */
export function toQuarterlyDate(code: string): string | null {
  const m = code.match(/^(\d{4})(0[1-4])$/);
  if (m === null) return null;
  const quarter = Number(m[2]);
  const lastMonth = quarter * 3;
  return `${m[1]}-${String(lastMonth).padStart(2, '0')}-01`;
}

/** 月次の `YYYYMM` (MM=01〜12) を `YYYY-MM-01` に直す。 */
export function toMonthlyDate(code: string): string | null {
  const m = code.match(/^(\d{4})(0[1-9]|1[0-2])$/);
  if (m === null) return null;
  return `${m[1]}-${m[2]}-01`;
}

interface BojSeriesResult {
  SERIES_CODE?: unknown;
  NAME_OF_TIME_SERIES_J?: unknown;
  VALUES?: {
    SURVEY_DATES?: unknown;
    VALUES?: unknown;
  };
}

/** 応答から観測値を取り出す。系列コード・系列名が一致しなければ失敗させる。 */
export function parseBojData(body: unknown, query: BojQuery): Observations {
  const status = (body as Record<string, unknown> | null)?.['STATUS'];
  if (status !== 200) {
    const message = (body as Record<string, unknown> | null)?.['MESSAGE'];
    throw new Error(`日銀API: ${query.code} の取得に失敗 (${String(message)})`);
  }

  const rows = (body as Record<string, unknown>)['RESULTSET'];
  const result = Array.isArray(rows) ? (rows[0] as BojSeriesResult | undefined) : undefined;
  if (result === undefined) {
    throw new Error(`日銀API: ${query.code} の応答に系列データが無い`);
  }
  if (result.SERIES_CODE !== query.code) {
    throw new Error(
      `日銀API: 系列コードが一致しない (要求 ${query.code} / 応答 ${String(result.SERIES_CODE)})`,
    );
  }
  if (result.NAME_OF_TIME_SERIES_J !== query.expectedName) {
    throw new Error(
      `日銀API: ${query.code} の系列名が変わっている` +
        ` (期待 "${query.expectedName}" / 実際 "${String(result.NAME_OF_TIME_SERIES_J)}")。` +
        `系列の構成が変わった可能性がある`,
    );
  }

  const dates = result.VALUES?.SURVEY_DATES;
  const values = result.VALUES?.VALUES;
  if (!Array.isArray(dates) || !Array.isArray(values) || dates.length !== values.length) {
    throw new Error(`日銀API: ${query.code} の日付と値の配列が不正`);
  }

  const toDate = query.db === 'CO' ? toQuarterlyDate : toMonthlyDate;
  const observations: Observations = {};
  for (let i = 0; i < dates.length; i += 1) {
    const rawDate = String(dates[i]);
    const rawValue = values[i];
    if (rawValue === null || rawValue === undefined) continue;
    const date = toDate(rawDate);
    if (date === null) {
      throw new Error(`日銀API: ${query.code} の日付形式が不正 (${rawDate})`);
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`日銀API: ${query.code} @${date} の値が数値でない (${String(rawValue)})`);
    }
    observations[date] = parsed;
  }

  if (Object.keys(observations).length === 0) {
    throw new Error(`日銀API: ${query.code} の観測が 0 件`);
  }
  return observations;
}

export async function fetchBojSeries(query: BojQuery): Promise<Observations> {
  const url = bojDataUrl(query);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`日銀APIの取得に失敗 (HTTP ${response.status}): ${url}`);
  }
  return parseBojData(await response.json(), query);
}
