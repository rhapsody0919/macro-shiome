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
  // 企業の景況感 BSI の規模別 3 本 (#226)。
  jpBsiLarge: '#1d4ed8',
  jpBsiMid: '#60a5fa',
  jpBsiSmall: '#93c5fd',
  /** 日銀短観 業況判断DI (大企業・製造業)。BSIを業種で補う (#228)。 */
  jpTankanLargeMfg: '#0ea5e9',
  jpTankanLargeNonmfg: '#f97316',
  // 国債の平均利率 3 本 (#222)。全体を太く、内訳を細く。
  treasuryAvgRate: '#0f766e',
  treasuryAvgRateBills: '#14b8a6',
  treasuryAvgRateNotes: '#5eead4',
  federalDebtPublic: '#b45309',
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
  /** 銅価格。原油と同じ上流の商品価格 (#337)。 */
  copperPrice: '#b45309',

  // --- 労働・所得 ---
  payrolls: '#0ea5e9',
  employmentLevel: '#f97316',
  fullTimeEmployment: '#a855f7',
  /** ADP雇用者数。BLS 系列との比較用 (#295)。 */
  adpEmployment: '#14b8a6',
  realIncomeExTransfer: '#10b981',
  realDisposablePerCapita: '#6366f1',

  /** 小売売上。個人消費の実データ。 */
  retailSales: '#14b8a6',

  // --- 住宅 (連鎖の上流 → 下流) ---
  buildingPermits: '#6366f1',
  housingStarts: '#0ea5e9',
  retailSalesTotal: '#94a3b8',
  vehicleSales: '#0ea5e9',
  /** トラック輸送量指数。実体経済の物流量 (#337)。 */
  truckTonnage: '#a855f7',
  newHomeSupply: '#0ea5e9',
  housingStartsSingle: '#94a3b8',
  nasdaqComposite: '#0ea5e9',
  djia: '#6366f1',
  usdEur: '#0ea5e9',
  cnyUsd: '#f59e0b',
  commercialLoans: '#6366f1',
  fedBalanceSheet: '#0ea5e9',
  /** マネーストック M2 (米国)。バランスシートの供給側に対する結果 (#337)。 */
  moneyStock: '#6366f1',
  termSpread3m: '#f59e0b',
  tbill3m: '#94a3b8',
  u6Rate: '#f59e0b',
  participationRate: '#6366f1',
  employmentRatio: '#94a3b8',
  hires: '#6366f1',
  quits: '#f59e0b',
  layoffs: '#ef4444',
  weeklyHoursTotal: '#94a3b8',
  continuedClaims: '#f59e0b',
  cpiCore: '#0ea5e9',
  pceCore: '#6366f1',
  cpiRent: '#94a3b8',
  producerPriceAll: '#f59e0b',
  breakeven5y: '#6366f1',
  breakeven5y5y: '#f59e0b',
  capacityUtilization: '#0ea5e9',
  durableGoodsOrders: '#6366f1',
  businessInventories: '#f59e0b',
  nfci: '#0ea5e9',
  anfci: '#6366f1',
  financialStress: '#94a3b8',
  twoYearRate: '#f59e0b',
  sofr: '#94a3b8',
  realConsumption: '#0ea5e9',
  jpUnemploymentRate: '#f59e0b',
  jpProducerPrice: '#6366f1',
  jpCurrentAccount: '#0ea5e9',
  jpTradeBalance: '#f59e0b',
  jpMoneyStock: '#6366f1',
  jpConsumption: '#0ea5e9',
  jpDisposableIncome: '#6366f1',
  jpPropensityToConsume: '#f59e0b',
  jpIndustrialProduction: '#6366f1',
  jpCpiCoreCore: '#f59e0b',
  jpShipments: '#6366f1',
  jpInventory: '#f59e0b',
  jpOperatingRate: '#0ea5e9',
  jpBankLending: '#0ea5e9',
  jpMonetaryBase: '#6366f1',
  jpWorkingHours: '#94a3b8',
  jpPublicWorks: '#6366f1',
  jpInventoryRatio: '#f59e0b',
  jpTopix: '#6366f1',
  jpConsumptionIndex: '#0ea5e9',
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
  jpGdpGrowth: '#0d9488',
  jpHousingStarts: '#0ea5e9',
  jpHousingStartsOwned: '#6366f1',
  jpHousingStartsRented: '#f59e0b',
  existingHomeSales: '#f59e0b',
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
  /** S&P500 の前年同日比 (%)。地区連銀サーベイと重ねて先行関係を見る (#287)。 */
  sp500Yoy: '#16a34a',
  /** 求人件数 (JOLTS)。 */
  jobOpenings: '#0ea5e9',
  /** 財政収支。赤字が続く側。 */
  federalDeficit: '#f97316',
  /** 失業率。 */
  unemploymentRate: '#ef4444',
  /** サーム・ルール景気後退指標。失業率から作られる (#337)。 */
  sahmRule: '#f97316',

  // --- その他 ---
  vix: '#ef4444',
  usdjpy: '#10b981',
  savingsRate: '#ef4444',
  consumerSentiment: '#eab308',
  /** VISA裁量的消費指数。非裁量的と対で見る (#294)。 */
  visaDiscretionary: '#f97316',
  /** VISA非裁量的消費指数。 */
  visaNonDiscretionary: '#78716c',

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
