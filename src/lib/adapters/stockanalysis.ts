/**
 * stockanalysis.com アダプタ。
 *
 * NASDAQ-100 の Trailing PER は QQQ (連動 ETF) 経由でしか無料取得経路が無い。
 * ETF の PER であり指数そのものの PER とは厳密には一致しないため、画面に明記する (spec D-15)。
 *
 * HTML スクレイピングなので構造変更で壊れる。**抽出できなかったら失敗**にして
 * silent な破損を防ぐ (plan U-9)。robots.txt は `/etf/` を許可しており、
 * 利用規約は出所明記を条件にスニペット利用を認めている。
 */

const BASE_URL = 'https://stockanalysis.com/etf';

/** 取得できるフィールド。増える場合はここに足す。 */
export type StockAnalysisField = 'peRatio';

/**
 * 表内のラベル。HTML の構造ではなくラベル名に依存させる方が構造変更に強い。
 *
 * **`Previous Close` は使わない** (#133)。ページは当日の終値を「価格」として表示し、
 * `Previous Close` は**その 1 つ前の取引日**を指す。金 22:00 ET に走る週次バッチで
 * 取ると木曜の終値になるため、金曜のキーで保存すると 1 取引日ずれる。
 * ゴールドは Finnhub の当日終値に切り替えた。
 */
const FIELD_LABELS: Record<StockAnalysisField, string> = {
  peRatio: 'PE Ratio',
};

/**
 * 値が指す日 = **最後に閉じた取引セッションの日** を返す ("YYYY-MM-DD"、#172)。
 *
 * スクレイピングや現在値 API で取れるのは「いまの値」だけなので、保存するキーは
 * 「いつの値か」で決める。ページや API が返す値は、**引け後なら当日の終値、
 * 引け前なら前営業日の終値**。
 *
 * **実行時刻から判定する。** 以前は常に前営業日を返していたため、米国東部の
 * 16:00〜24:00 に実行すると必ず 1 日ずれた (#172 で ETF 36 本が実際にずれた)。
 * 定時実行 (UTC 02:00 = ET 前日 21 時) では前営業日が正解になるので気付けなかった。
 *
 * | 実行 (ET) | 返す日 |
 * | --- | --- |
 * | 平日 16:00 以降 (引け後) | **当日** |
 * | 平日 16:00 より前 | 前営業日 |
 * | 土日 | 直前の金曜 |
 *
 * 夏時間があるため UTC からの単純な引き算では判定できない。`Intl` で東部時間の
 * 日付と時刻を取り出す。
 *
 * 祝日は考慮しない。取引所が休みだった日をキーにしても、表示グリッドは直近の
 * 営業日まで遡るため壊れない。
 */
export function lastClosedTradingDay(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  const cursor = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const isWeekday = (date: Date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;

  // 平日の引け後なら、その日のセッションが最後に閉じたもの。
  if (Number(parts.hour) >= 16 && isWeekday(cursor)) return cursor.toISOString().slice(0, 10);

  do {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  } while (!isWeekday(cursor));
  return cursor.toISOString().slice(0, 10);
}

export function stockAnalysisEtfUrl(symbol: string): string {
  return `${BASE_URL}/${symbol.toLowerCase()}/`;
}

/**
 * HTML から指定フィールドの数値を取り出す。
 *
 * `<td>PE Ratio</td><td>33.62</td>` という表構造を、タグを区切りに置き換えてから拾う。
 * クラス名や属性の変更に影響されないようにするため、生の HTML には正規表現を当てない。
 */
/**
 * タグを区切り文字に潰す。属性やクラス名の変更で壊れないようにする。
 *
 * 整形済み HTML では改行やインデントがタグ間に入るため、区切りの前後の空白も除去して
 * 一行の HTML と同じ形に揃える。
 */
function flatten(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '|')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\|+/g, '|');
}

export function parseStockAnalysisField(html: string, field: StockAnalysisField): number {
  const label = FIELD_LABELS[field];

  const flat = flatten(html);

  // ラベルのセルの直後のセルが値。
  // 終端の区切りは先読みにする。消費すると、隣り合う 2 件目の検出に必要な区切りが失われる。
  const pattern = new RegExp(`\\|${escapeRegExp(label)}\\|(-?[\\d,]+(?:\\.\\d+)?)(?=\\||$)`, 'g');
  const matches = [...flat.matchAll(pattern)];

  if (matches.length === 0) {
    throw new Error(
      `stockanalysis: "${label}" の値を抽出できなかった。HTML 構造が変わった可能性がある`,
    );
  }

  const values = matches.map((m) => Number.parseFloat(m[1].replace(/,/g, '')));
  for (const [i, value] of values.entries()) {
    if (!Number.isFinite(value)) {
      throw new Error(`stockanalysis: "${label}" が数値として解釈できない (${matches[i][1]})`);
    }
  }

  // 値が食い違う箇所が複数あるなら、別の表を拾っている可能性がある。
  const unique = [...new Set(values)];
  if (unique.length > 1) {
    throw new Error(
      `stockanalysis: "${label}" の値が食い違う箇所が複数ある (${unique.join(', ')})`,
    );
  }

  return unique[0];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ETF ページを取得してフィールドを抽出する。 */
export async function fetchEtfField(
  symbol: string,
  field: StockAnalysisField,
): Promise<number> {
  const url = stockAnalysisEtfUrl(symbol);
  const response = await fetch(url, {
    // 既定の UA だとブロックされる場合があるため、通常のブラウザとして振る舞う。
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; macro-shiome/1.0)' },
  });

  if (!response.ok) {
    throw new Error(`stockanalysis の取得に失敗 (HTTP ${response.status}): ${url}`);
  }

  return parseStockAnalysisField(await response.text(), field);
}

/** 履歴ページの 1 日分。日付をキーに終値を照合するために使う (#133)。 */
export interface DailyClose {
  date: string;
  close: number;
}

export function stockAnalysisHistoryUrl(symbol: string): string {
  return `${BASE_URL}/${symbol.toLowerCase()}/history/`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * 履歴ページから日付付きの終値を取り出す (#133)。
 *
 * **現在値のスクレイピングでは「値が指す日」を取り違えうる**ため、日付が明示されている
 * この経路を検証に使う。実際、`Previous Close` を当日終値と誤認して 1 取引日ずれていた。
 *
 * 表は `Date | Open | High | Low | Close | Adj. Close | Change | Volume` の並び。
 * 列の位置ではなく「日付の直後に 4 つの価格が並ぶ」形で拾う。
 */
export function parseStockAnalysisHistory(html: string): DailyClose[] {
  const flat = flatten(html);
  const pattern =
    /\|([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\|([\d,]+\.\d+)\|([\d,]+\.\d+)\|([\d,]+\.\d+)\|([\d,]+\.\d+)\|/g;

  const rows: DailyClose[] = [];
  for (const m of flat.matchAll(pattern)) {
    const month = MONTHS.indexOf(m[1] as (typeof MONTHS)[number]);
    if (month < 0) continue;
    const date = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const close = Number.parseFloat(m[7].replace(/,/g, ''));
    if (!Number.isFinite(close)) {
      throw new Error(`stockanalysis: 履歴の終値が数値として解釈できない (${date}: ${m[7]})`);
    }
    rows.push({ date, close });
  }

  if (rows.length === 0) {
    throw new Error('stockanalysis: 履歴の行を抽出できなかった。HTML 構造が変わった可能性がある');
  }
  return rows;
}

/** 履歴ページを取得して日付付きの終値を返す。 */
export async function fetchEtfHistory(symbol: string): Promise<DailyClose[]> {
  const url = stockAnalysisHistoryUrl(symbol);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; macro-shiome/1.0)' },
  });
  if (!response.ok) {
    throw new Error(`stockanalysis の取得に失敗 (HTTP ${response.status}): ${url}`);
  }
  return parseStockAnalysisHistory(await response.text());
}
