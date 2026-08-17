/**
 * 系列の色 (#77)。
 *
 * **同じ意味の系列には同じ色を使う。** 色を各チャートに直書きしていたため、
 * 「実質金利」が金利チャートでは青、イールドスプレッドの内訳では橙になっていた。
 * ページを横断すると色が手がかりにならない。
 *
 * ライト・ダーク両方で視認できる中間の明度を選ぶ (背景に溶ける濃色は使わない)。
 */
export const COLORS = {
  // --- 金利 ---
  /** 名目 10 年債利回り。 */
  nominalRate: '#f97316',
  /** 期待インフレ率。 */
  breakeven: '#a855f7',
  /** 実質金利。名目とインフレの差なので、両方と区別できる色にする。 */
  realRate: '#0ea5e9',
  /** イールドカーブ (長短金利差)。 */
  termSpread: '#6366f1',
  /** 住宅ローン金利。 */
  mortgageRate: '#ec4899',

  // --- 株式 ---
  /** 指数そのもの。目立たせず背景的に扱う。 */
  index: '#64748b',
  forwardEps: '#3b82f6',
  trailingEps: '#f59e0b',
  forwardPe: '#8b5cf6',
  /** 株式益回り。実質金利との対比で使う。 */
  earningsYield: '#8b5cf6',
  /** イールドスプレッド。 */
  yieldSpread: '#0ea5e9',
  /** 理論値。 */
  fairValue: '#10b981',

  // --- 物価 (連鎖の上流 → 下流) ---
  importPrice: '#f97316',
  producerPrice: '#a855f7',
  cpi: '#0ea5e9',
  pce: '#10b981',

  // --- 労働・所得 ---
  payrolls: '#0ea5e9',
  employmentLevel: '#f97316',
  fullTimeEmployment: '#a855f7',
  realIncomeExTransfer: '#10b981',
  realDisposablePerCapita: '#6366f1',

  // --- 住宅 (連鎖の上流 → 下流) ---
  buildingPermits: '#6366f1',
  housingStarts: '#0ea5e9',
  newHomeSales: '#10b981',

  // --- その他 ---
  vix: '#ef4444',
  usdjpy: '#10b981',
  savingsRate: '#ef4444',
  consumerSentiment: '#eab308',

  // --- 意味を持つ塗り ---
  /** 割高・逆イールドなど、注意を向ける側。 */
  negative: '#ef4444',
  /** 割安・改善側。 */
  positive: '#10b981',
} as const;
