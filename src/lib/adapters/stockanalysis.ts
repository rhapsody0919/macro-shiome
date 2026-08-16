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

/** 表内のラベル。HTML の構造ではなくラベル名に依存させる方が構造変更に強い。 */
const FIELD_LABELS: Record<StockAnalysisField, string> = {
  peRatio: 'PE Ratio',
};

export function stockAnalysisEtfUrl(symbol: string): string {
  return `${BASE_URL}/${symbol.toLowerCase()}/`;
}

/**
 * HTML から指定フィールドの数値を取り出す。
 *
 * `<td>PE Ratio</td><td>33.62</td>` という表構造を、タグを区切りに置き換えてから拾う。
 * クラス名や属性の変更に影響されないようにするため、生の HTML には正規表現を当てない。
 */
export function parseStockAnalysisField(html: string, field: StockAnalysisField): number {
  const label = FIELD_LABELS[field];

  // タグを区切り文字に潰す。属性やクラス名の変更で壊れないようにする。
  // 整形済み HTML では改行やインデントがタグ間に入るため、区切りの前後の空白も除去して
  // 一行の HTML と同じ形に揃える。
  const flat = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '|')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\|+/g, '|');

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
