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
  /** 10年債入札の応札倍率。 */
  bidToCover: '#0369a1',
  /** 輸出物価。輸入物価と対で交易条件を見る。 */
  exportPrice: '#f472b6',
  /** ゴールド (GLD)。現物価格ではなく ETF の価格。 */
  gold: '#eab308',
  /** 日経平均株価。円建てなので S&P 500 とは別の軸で読む。 */
  nikkei225: '#e11d48',
  /** 日本の 10 年債利回り。 */
  jpTenYear: '#dc2626',
  /** ドイツの 10 年債利回り。 */
  deTenYear: '#ca8a04',
  /** 潜在成長率 (CBO 推計)。 */
  potentialGrowth: '#14b8a6',
  /**
   * 10 年債の理論値 (期待インフレ率 + 潜在成長率)。
   *
   * 名目 10 年債と比べる相手なので、名目 (橙) と明確に区別できる色にする。
   */
  treasuryFairValue: '#84cc16',
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

  /** 小売売上。個人消費の実データ。 */
  retailSales: '#14b8a6',

  // --- 住宅 (連鎖の上流 → 下流) ---
  buildingPermits: '#6366f1',
  housingStarts: '#0ea5e9',
  realConsumption: '#0ea5e9',
  jpCurrentAccount: '#0ea5e9',
  jpTradeBalance: '#f59e0b',
  jpMoneyStock: '#6366f1',
  jpConsumption: '#0ea5e9',
  jpDisposableIncome: '#6366f1',
  jpPropensityToConsume: '#f59e0b',
  jpIndustrialProduction: '#6366f1',
  jpCpiCore: '#0ea5e9',
  jpCpi: '#94a3b8',
  jpWatcherCurrent: '#0ea5e9',
  jpWatcherOutlook: '#f59e0b',
  jpRealWage: '#0ea5e9',
  jpNewJobRatio: '#6366f1',
  jpJobRatio: '#94a3b8',
  jpExportPrice: '#0ea5e9',
  jpImportPrice: '#f59e0b',
  jpDiLeading: '#0ea5e9',
  jpDiCoincident: '#6366f1',
  jpDiLagging: '#94a3b8',
  jpHousingStarts: '#0ea5e9',
  jpHousingStartsOwned: '#6366f1',
  jpHousingStartsRented: '#f59e0b',
  newHomeSales: '#10b981',

  /** 新規失業保険申請。増加が悪化を意味するため警戒色。 */
  initialClaims: '#ef4444',
  /** 製造業の週平均労働時間。 */
  manufacturingHours: '#8b5cf6',
  /** 信用状況。引き締まり (正) が警戒側。 */
  creditConditions: '#f43f5e',
  /** 鉱工業生産。 */
  industrialProduction: '#0ea5e9',
  newOrdersConsumerGoods: '#f97316',
  newOrdersCapitalGoods: '#a855f7',

  /** ハイイールド債スプレッド。拡大が警戒側。 */
  hySpread: '#f43f5e',
  /** 投資適格債スプレッド。 */
  igSpread: '#f59e0b',
  /** FF 実効金利。政策金利。 */
  fedFundsRate: '#22c55e',
  /** 原油 WTI。 */
  wti: '#78716c',
  /** ドル指数。 */
  dollarIndex: '#0891b2',
  /** 新規求人。労働市場の先行指標。 */
  newJobPostings: '#06b6d4',
  /** 個人貯蓄額。貯蓄率と対で見る。 */
  personalSaving: '#0d9488',
  /** 実質可処分所得 (総額)。1 人当たりと対で見る。 */
  realDisposableTotal: '#7c3aed',
  /** NY連銀景気指数 (拡散指数)。 */
  nyFedSurvey: '#8b5cf6',
  /** フィラデルフィア連銀景気指数 (拡散指数)。 */
  phillyFedSurvey: '#d946ef',
  /** 求人件数 (JOLTS)。 */
  jobOpenings: '#0ea5e9',
  /** 財政収支。赤字が続く側。 */
  federalDeficit: '#f97316',
  /** 失業率。 */
  unemploymentRate: '#ef4444',

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

/**
 * 下落率チャートの系列色 (#128)。
 *
 * **`COLORS` とは別に置く。** あちらは「1 系列 1 色」で意味が固定されているが、
 * こちらは 1 枚に最大 13 本並ぶ資産へ順番に割り当てるパレット。
 * 隣り合う色が似ないよう色相を飛ばして並べている。
 */
export const DRAWDOWN_PALETTE: readonly string[] = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
  '#0d9488',
  '#b91c1c',
  '#a16207',
];
