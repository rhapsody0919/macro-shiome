/**
 * e-Stat 統計 API アダプタ (#160)。**7 つ目のデータソース。**
 *
 * **統計ダッシュボード (`estat-dashboard.ts`) とは別物。** あちらは登録不要で系列単位、
 * こちらは **appId 必須**で統計表単位。応答形式も日付形式も違うため使い回せない。
 * 使うのはダッシュボードに無い表だけ (ADR-0007)。
 *
 * **appId は公開してはいけない。** public リポの Actions ログは誰でも読めるため、
 * 例外にもログにも URL を丸ごと載せない (FRED / Finnhub と同じ扱い)。
 *
 * **1 つの表に多数の系列が入っている。** 景気ウォッチャーなら表章項目 × 分野 ×
 * 方向性で数十通りある。軸をすべて固定しないと同じ月に複数の値が返る
 * (#96 の「10年債入札に TIPS が混入」、#129 の `cycle`/`isSeasonal` と同じ型)。
 */
import type { Observations } from './fred';

const BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';

export interface EstatTableQuery {
  statsDataId: string;
  /** 表章項目 (例: DI)。 */
  tab: string;
  /** 分類軸 1 (例: 分野 = 合計)。 */
  cat01: string;
  /** 分類軸 2 (例: 現状判断 / 先行き判断)。 */
  cat02: string;
}

/**
 * 例外に載せて安全なラベル。**appId を含めない。**
 *
 * URL を丸ごと出すと、クエリ文字列に入っている appId がそのままログに残る。
 */
export function safeQueryLabel(query: EstatTableQuery): string {
  return `statsDataId=${query.statsDataId} tab=${query.tab} cat01=${query.cat01} cat02=${query.cat02}`;
}

export function readEstatAppIdFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const appId = env.ESTAT_APP_ID;
  if (appId === undefined || appId.length === 0) {
    throw new Error(
      '環境変数 ESTAT_APP_ID が未設定。GitHub Actions Secrets に登録し、ワークフローから渡す',
    );
  }
  return appId;
}

/**
 * `2026000606` を `2026-06-01` に直す。
 *
 * 統計 API の月次コードは **YYYY + "00" + MM + MM** の 10 桁。統計ダッシュボードの
 * `YYYYMM00` とは別形式なので、取り違えると全部の日付がずれる。
 * 年次・年度は桁数も並びも違うため、この形に一致しないものは月次ではない。
 */
export function toMonthlyDate(time: string): string | null {
  const m = time.match(/^(\d{4})00(\d{2})(\d{2})$/);
  if (m === null) return null;
  // 末尾 2 桁は月の繰り返し。食い違うなら月次コードではない。
  if (m[2] !== m[3]) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

interface StatsValue {
  '@time'?: unknown;
  '@tab'?: unknown;
  '@cat01'?: unknown;
  '@cat02'?: unknown;
  $?: unknown;
}

/**
 * 応答から観測値を取り出す。
 *
 * **軸が 1 種類に絞れていることを検査する。** 絞り込みが外れると同じ月に複数の値が
 * 入り、最後に読んだものが勝つ形で静かに間違う。件数だけ見ても気付けない。
 */
export function parseStatsData(body: unknown, query: EstatTableQuery): Observations {
  const root = (body as Record<string, unknown> | null)?.['GET_STATS_DATA'];
  const status = String(
    ((root as Record<string, unknown> | undefined)?.['RESULT'] as Record<string, unknown> | undefined)
      ?.['STATUS'] ?? '',
  );
  if (status !== '0') {
    const message = (
      (root as Record<string, unknown> | undefined)?.['RESULT'] as Record<string, unknown> | undefined
    )?.['ERROR_MSG'];
    throw new Error(
      `e-Stat: 取得に失敗 (${safeQueryLabel(query)})` +
        (typeof message === 'string' ? `: ${message}` : ''),
    );
  }

  const stats = (root as Record<string, unknown>)['STATISTICAL_DATA'];
  const dataInf = (stats as Record<string, unknown> | undefined)?.['DATA_INF'];
  const raw = (dataInf as Record<string, unknown> | undefined)?.['VALUE'];
  const rows: StatsValue[] = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw as StatsValue];

  const seen: Record<'tab' | 'cat01' | 'cat02', Set<string>> = {
    tab: new Set(),
    cat01: new Set(),
    cat02: new Set(),
  };
  const observations: Observations = {};

  for (const row of rows) {
    seen.tab.add(String(row['@tab']));
    seen.cat01.add(String(row['@cat01']));
    seen.cat02.add(String(row['@cat02']));

    const date = toMonthlyDate(String(row['@time']));
    if (date === null) continue;

    const value = Number(row.$);
    if (!Number.isFinite(value)) {
      // 「-」や「***」が入ることがある。数値でないものは欠測として飛ばさず失敗させる。
      throw new Error(
        `e-Stat: 値が数値でない (${safeQueryLabel(query)} @${date}: ${String(row.$)})`,
      );
    }
    observations[date] = value;
  }

  for (const [axis, values] of Object.entries(seen)) {
    if (values.size > 1) {
      throw new Error(
        `e-Stat: ${axis} が 1 種類に絞れていない (${safeQueryLabel(query)}: ` +
          `${[...values].join(', ')})。同じ月に複数の値が入る`,
      );
    }
  }

  if (Object.keys(observations).length === 0) {
    throw new Error(
      `e-Stat: 条件に合う観測が 0 件 (${safeQueryLabel(query)})。表の構成が変わった可能性がある`,
    );
  }
  return observations;
}

export class EstatClient {
  private readonly appId: string;

  constructor(options: { appId: string }) {
    this.appId = options.appId;
  }

  async fetchTable(query: EstatTableQuery): Promise<Observations> {
    const params = new URLSearchParams({
      appId: this.appId,
      statsDataId: query.statsDataId,
      cdTab: query.tab,
      cdCat01: query.cat01,
      cdCat02: query.cat02,
    });

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}?${params.toString()}`);
    } catch (cause) {
      // cause に URL が含まれることがあるためメッセージのみを取り出す。
      throw new Error(
        `e-Stat への接続に失敗 (${safeQueryLabel(query)}): ` +
          (cause instanceof Error ? cause.message : String(cause)),
      );
    }

    if (!response.ok) {
      throw new Error(
        `e-Stat が ${response.status} を返した (${safeQueryLabel(query)})。appId か statsDataId を確認する`,
      );
    }
    return parseStatsData(await response.json(), query);
  }
}
