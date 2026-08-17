/**
 * データ層の型定義 (ADR-0004: 指標マスタ + 観測値の縦持ち)。
 *
 * 指標は継続的に増える前提。指標ごとに型や構造を作り分けず、
 * マスタ (メタデータ) と観測値 (日付 → 値) に分離する。
 */

/** 更新頻度。日次・週次・月次が混在するため、画面側で粒度を明示する必要がある。 */
export type Frequency = 'daily' | 'weekly' | 'monthly';

/** 値の単位。同じ number でも意味が違うため取り違えを防ぐ。 */
export type Unit =
  | 'index' // 指数のポイント
  | 'percent' // %。小数表記 (0.042) との混在は不可
  | 'ratio' // 倍率 (PER など)
  | 'jpy-per-usd';

/**
 * 著作権区分。`restricted` は出所明記と再配布への注意が要る系列
 * (S&P Dow Jones Indices / Nasdaq, Inc. / FactSet)。spec F-11 の表示義務に対応する。
 */
export type CopyrightClass = 'none' | 'restricted';

/** 画面上のグルーピング。 */
export type IndicatorGroup = 'equity' | 'valuation' | 'rates' | 'fx' | 'volatility' | 'macro';

/**
 * 景気サイクルに対する位置 (#62)。
 *
 * **分類は The Conference Board の景気指数の構成要素を根拠にする**。独自判断で分類しない。
 * 2026-08-17 に公式ページ (https://www.conference-board.org/topics/us-leading-indicators) で
 * 確認した構成要素は次のとおり。
 *
 * **先行 (LEI、10 要素)**: 製造業の週平均労働時間 / 新規失業保険申請件数 (週平均) /
 * 消費財・原材料の新規受注 / ISM 新規受注指数 / 航空機を除く非国防資本財の新規受注 /
 * **新設住宅建設許可** / **S&P 500 株価指数** / Leading Credit Index /
 * **金利スプレッド (10 年債 − FF 金利)** / 消費者の景況感期待
 *
 * **一致 (CEI、4 要素)**: 非農業部門雇用者数 / **移転所得を除く個人所得** /
 * 製造業・商業売上高 / 鉱工業生産
 *
 * `undefined` は「この分類に当てはまらない」を表す。為替や VIX のように
 * 景気サイクルの尺度として定義されていない指標がある。**無理に分類しない**。
 */
export type CyclePosition = 'leading' | 'coincident' | 'lagging';

/**
 * FactSet 週次 PDF から抽出するフィールド。
 * すべて本文テキスト層から正規表現で取得する (OCR は使わない。spec 3 節)。
 */
export type FactsetField =
  | 'forwardPe'
  | 'trailingPe'
  | 'forwardPe5yAvg'
  | 'forwardPe10yAvg'
  | 'trailingPe5yAvg'
  | 'trailingPe10yAvg'
  | 'closePrice'
  /** 進行中四半期の blended 成長率。今週 / 先週 / 四半期末の 3 時点 (spec D-18)。 */
  | 'blendedGrowthToday'
  | 'blendedGrowthLastWeek'
  | 'blendedGrowthQuarterEnd'
  /** 次期以降の予想成長率 (spec D-19)。対象期は観測日から決まる。 */
  | 'growthNextQuarter'
  | 'growthQuarterAfterNext'
  | 'growthCurrentCalendarYear'
  | 'growthNextCalendarYear';

/**
 * 取得元。判別可能ユニオンにして、アダプタごとに必要な設定を型で強制する。
 * 新しい取得元が必要になったらここに追加する。
 */
export type IndicatorSource =
  | { adapter: 'fred'; seriesId: string }
  | { adapter: 'factset-pdf'; field: FactsetField }
  | { adapter: 'stockanalysis'; symbol: string; field: 'peRatio' };

/** 指標マスタの 1 エントリ。 */
export interface Indicator {
  /** 表示名 (日本語)。 */
  name: string;
  source: IndicatorSource;
  frequency: Frequency;
  unit: Unit;
  /** 出所の表記。spec F-11 でそのまま画面に出す。 */
  attribution: string;
  copyright: CopyrightClass;
  group: IndicatorGroup;
  /**
   * 取得できる履歴の上限。FRED の S&P 500 は契約上 10 年しか提供されない。
   * 制限が無い場合は省略する。
   */
  historyLimit?: '10y' | '5y';
  /**
   * 号によって記載が無いことがある項目 (#53)。
   *
   * true なら、抽出できなかったときに `fetch-failed` (要調査) ではなく
   * `not-in-report` (正常) として記録する。**正常な欠測を異常として扱わないため**。
   */
  optionalInReport?: boolean;
  /**
   * 景気サイクルに対する位置 (#62)。省略可。
   *
   * 省略は「まだ分類していない」ではなく「**この分類に当てはまらない**」を意味する。
   * 当てはまらない指標を無理に分類すると、根拠の無い先行性を主張することになる。
   */
  cyclePosition?: CyclePosition;
  /** 補足 (定義の注意点など)。 */
  note?: string;
}

/** 指標マスタ全体。キーが指標 ID。 */
export type IndicatorMaster = Record<string, Indicator>;

/**
 * 観測値ファイル。**日付をキーにすることで UPSERT の冪等性を構造で保証する**
 * (同じ週に再実行しても同じキーが上書きされるだけで重複しない)。
 *
 * 欠測は「キーを作らない」で表現する。null を入れると
 * 「取得したが値が無い」と区別できなくなるため。
 */
export interface ObservationFile {
  indicatorId: string;
  /** ISO 8601。 */
  updatedAt: string;
  /** "YYYY-MM-DD" → 値。 */
  observations: Record<string, number>;
}

/**
 * 欠測の理由。画面で区別して表示する (screens 共通の状態)。
 *
 * **「異常なもの」と「正常なもの」を混ぜない**。取得失敗だけが調査対象で、
 * 残り 2 つはデータ提供元の仕様どおりの状態。
 */
export type GapReason =
  /** レポート自体が発行されなかった週。異常ではない。 */
  | 'publication-break'
  /**
   * レポートは出ているが、その号にその項目の記載が無い。異常ではない (#53)。
   *
   * 例: FactSet の翌暦年 (CY N+1) 予想は年央 (6 月頃) から載り始めるため、
   * 年前半の号には存在しない。実 PDF で確認済み
   * (2026-05-01 / 2026-06-05 は CY 2026 のみ、2026-06-12 から CY 2027 が登場)。
   */
  | 'not-in-report'
  /** 取得に失敗した。要調査。 */
  | 'fetch-failed';

export interface Gap {
  indicatorId: string;
  /** "YYYY-MM-DD"。 */
  date: string;
  reason: GapReason;
  detail?: string;
  recordedAt: string;
}

/** バッチの実行状況。画面ヘッダーの鮮度表示に使う (screens N-1)。 */
export interface BatchStatus {
  /** 全指標の取得に成功した最後の時刻 (ISO 8601)。 */
  lastSuccessAt: string | null;
  lastRunAt: string;
  /** 直近の欠測。新しい順。 */
  recentGaps: Gap[];
}

/** 基準益回りの設定履歴の 1 件 (spec F-13)。 */
export interface TargetYieldEntry {
  /** % 表記 (例: 3.67)。 */
  value: number;
  /** この値を使い始めた日 "YYYY-MM-DD"。 */
  from: string;
  /** 変更理由。成長率の前提が変われば見直す値のため必須にする。 */
  reason: string;
  /**
   * 設定した時点の実質金利 (%)。省略可。
   *
   * 基準益回りを実質金利に自動連動させるのは採用しなかった (実質金利がマイナスの局面で
   * 理論値が発散するため。#46)。代わりにこの値を残し、現在の実質金利との乖離を見て
   * 人が見直しを判断できるようにする。
   */
  realRateAtSetting?: number;
}

/** 指数の識別子。バリュエーション画面の切り替え対象。 */
export type IndexKey = 'sp500' | 'nasdaq100';

/**
 * 人が決める設定。外部から取得できる値ではない。
 * 理論値・割高率はこの設定に依存するため、画面に設定値を必ず併記する (spec F-13)。
 */
export interface AppConfig {
  /** 指数ごとの基準益回り。新しい順ではなく **from の昇順**で持つ。 */
  targetYield: Record<IndexKey, TargetYieldEntry[]>;
}

/** 相関の表示単位 (spec F-5)。期間フィルターに追従しない 3 つの窓。 */
export interface CorrelationSummary {
  halfYear: CorrelationValue;
  oneYear: CorrelationValue;
  all: CorrelationValue;
}

export type CorrelationValue =
  | { kind: 'ok'; r: number; n: number }
  | { kind: 'insufficient'; n: number };

/**
 * イールドスプレッドの水準を読むための分布 (#52)。
 *
 * **固定の「危険水準」は置かない**。「1% を切ったら危険」のような線には定説が無く、
 * 恣意的な基準になる (VIX に補助線を引かなかったのと同じ判断。plan U-S1)。
 * 客観的な基準はゼロ (株式益回り = 実質金利) と、実データから求めた分布の 2 つだけ。
 */
export interface SpreadDistribution {
  /** 集計した窓の年数。 */
  years: number;
  mean: number;
  /** 標本標準偏差。平均 ±1σ を補助線として出す。 */
  sd: number;
  n: number;
  /** 直近値。 */
  latest: number;
  /** 直近値が分布の下から何 % の位置にあるか (0〜100)。 */
  latestPercentile: number;
  /** 直近値の観測日。 */
  latestDate: string;
}

/** 指数ごとのビュー。 */
export interface ValuationSeries {
  points: ValuationPoint[];
  /** Forward P/E の基準線。毎週更新される値で、固定値ではない (spec F-3)。 */
  baselines: {
    pe5y: number | null;
    pe10y: number | null;
    /** 基準線を取得した観測日。画面に表示する。 */
    asOf: string | null;
  };
  /** この指数に適用した基準益回り (%)。設定依存の数値なので画面に必ず出す (spec F-13)。 */
  targetYield: number;
  /** 基準益回りの妥当性を判断するための文脈 (#46)。 */
  targetYieldContext: {
    /** 設定した時点の実質金利 (%)。記録が無ければ null。 */
    realRateAtSetting: number | null;
    /** 直近の実質金利 (%)。 */
    currentRealRate: number | null;
    /** 現在 − 設定時 (pt)。大きく動いていれば見直しを促す。 */
    drift: number | null;
    /** 基準益回りのうち実質金利で説明されない部分 = リスクプレミアム (pt)。 */
    riskPremium: number | null;
  };
  /** 指数と Forward EPS の相関 (spec F-5)。 */
  correlation: CorrelationSummary;
  /**
   * イールドスプレッドの過去分布 (#52)。標本不足なら null。
   *
   * **期間フィルターに追従しない固定窓**。フィルターで基準が動くと
   * 「今が過去に比べてどこか」の比較にならないため。
   */
  spreadDistribution: SpreadDistribution | null;
  /** Forward EPS を持つか。NASDAQ-100 は取得経路が無いため false (screens C-2)。 */
  hasForwardEps: boolean;
  /**
   * 履歴を過去に遡って取得できない理由。遡れるなら null (#54)。
   *
   * `hasForwardEps` が**恒久的な**制約を表すのに対し、こちらは**時間で解消する**制約。
   * 画面はこの 2 つを区別して表示する必要があるため、取得層の事実をここまで持ち上げる。
   */
  accumulationNote: string | null;
}

/** 画面用ビュー全体。 */
export interface ValuationView {
  generatedAt: string;
  sp500: ValuationSeries;
  nasdaq100: ValuationSeries;
}

/** マクロ指標の 1 週分 (spec F-7)。週次 (金曜) に揃える。 */
export interface MacroPoint {
  date: string;
  vix: number | null;
  usdjpy: number | null;
  /** 名目 10 年債利回り (%)。 */
  nominalRate: number | null;
  /** 期待インフレ率 (10 年 BEI、%)。 */
  breakeven: number | null;
  /** 実質金利 = 名目 − 期待インフレ率 (%)。 */
  realRate: number | null;
  /**
   * イールドカーブ (10 年債 − 2 年債、%)。負なら逆イールド (#63)。
   *
   * **イールドスプレッド (株式益回り − 実質金利) とは別物**。あちらは株式と債券の
   * 相対的な魅力、こちらは長短金利の傾きで景気の先行指標。
   */
  termSpread: number | null;
  /**
   * 住宅ローン金利 (30 年固定、%)。
   *
   * 住宅ローン申請者数 (MBA) は FRED に無いため、その代替として住宅需要の背景要因を見る。
   * **申請そのものより先行性は落ちる** (#65)。
   */
  mortgageRate: number | null;
  /**
   * 新規失業保険申請件数 (人)。週次で取れる数少ない先行指標 (#82)。
   *
   * **増加が悪化を意味する**ため、他の指標と向きが逆になる。
   */
  initialClaims: number | null;
  /**
   * 信用状況指数 (Chicago Fed)。ゼロが平均で、正が引き締まり・負が緩み (#83)。
   *
   * The Conference Board の Leading Credit Index とは別物。あちらは独自の合成指標で
   * 公開されていない。
   */
  creditConditions: number | null;
  /** ハイイールド債スプレッド (%)。拡大がリスク回避を示す (#84)。 */
  hySpread: number | null;
  /** 投資適格債スプレッド (%)。 */
  igSpread: number | null;
  /** FF 実効金利 (%)。政策金利の実際の水準。 */
  fedFundsRate: number | null;
  /** 原油 WTI (ドル/バレル)。 */
  wti: number | null;
  /** ドル指数 (Jan 2006=100)。主要通貨に対する総合的な強さ。 */
  dollarIndex: number | null;
}

/**
 * 月次指標の 1 か月分 (#64 / #66)。
 *
 * 横軸が同じ (対象月) なので 1 つの配列にまとめる。
 *
 * **物価・労働・所得は前年同月比 (%)**。指標ごとに基準年や単位が違い
 * (物価は 4 種類の基準年、雇用は千人、所得は 10 億ドル)、水準を並べても比較にならない。
 * **貯蓄率と消費者信頼感は水準そのもの**が意味を持つため変換しない。
 */
export interface MonthlyPoint {
  /** 対象月 "YYYY-MM-01"。**発表日ではない**。 */
  month: string;

  // --- 物価 (前年同月比 %) ---
  /** 輸入物価。連鎖の起点。 */
  importPrice: number | null;
  /** 生産者物価 (Final Demand)。 */
  producerPrice: number | null;
  cpi: number | null;
  /** FRB が最も重視するインフレ指標。 */
  pce: number | null;

  // --- 労働市場 (前年同月比 %) ---
  /** 非農業部門雇用者数。事業所調査で自営業・農業を含まない。 */
  payrolls: number | null;
  /** 就業者数。家計調査で自営業・農業を含む。 */
  employmentLevel: number | null;
  /** フルタイム就業者数。 */
  fullTimeEmployment: number | null;

  // --- 所得 (前年同月比 %) ---
  /** 移転所得を除く実質個人所得。景気一致指数の構成要素。 */
  realIncomeExTransfer: number | null;
  /** 1 人当たり実質可処分所得。 */
  realDisposablePerCapita: number | null;

  /**
   * 小売売上 (自動車・ガソリンを除く) の前年同月比。
   *
   * **コントロールグループではない** (建材と外食が含まれる)。#72 参照。
   */
  retailSales: number | null;

  /**
   * 製造業の週平均労働時間 (時間、水準)。景気先行指数の構成要素。
   *
   * 企業は解雇の前に残業を減らすため、雇用者数より早く動く。
   */
  manufacturingHours: number | null;

  // --- 生産・受注 (前年同月比 %) ---
  /** 鉱工業生産。景気一致指数の構成要素。 */
  industrialProduction: number | null;
  /** 消費財の新規受注。景気先行指数の構成要素。 */
  newOrdersConsumerGoods: number | null;
  /** 非国防資本財 (航空機を除く) の新規受注。設備投資意欲を示す。 */
  newOrdersCapitalGoods: number | null;

  // --- 住宅市場 (水準、千戸・季節調整済み年率) ---
  /** 建設許可件数。景気先行指数の構成要素で、着工より前の段階。 */
  buildingPermits: number | null;
  /** 住宅着工件数。 */
  housingStarts: number | null;
  /** 新築住宅販売件数。連鎖の下流。 */
  newHomeSales: number | null;

  // --- 水準 ---
  /** 失業率 (%)。水準そのものが意味を持つ。 */
  unemploymentRate: number | null;
  /** 貯蓄率 (%)。低下は貯蓄の取り崩しを示す。 */
  savingsRate: number | null;
  /** ミシガン大学消費者信頼感指数 (1966:Q1=100)。 */
  consumerSentiment: number | null;
}

/**
 * 月次指標の発表状況 (#64)。
 *
 * **発表ラグは指標ごとに違う**。2026-08-17 時点で CPI と PPI は 7 月分まで出ているのに、
 * 輸入物価と PCE は 6 月分止まり。「最新」がどの月かを指標ごとに示さないと、
 * 同じ時点のデータを比べていると誤解される。
 */
export interface MonthlyCoverage {
  /** 指標マスタの ID。 */
  indicatorId: string;
  /** 値を持つ最も新しい対象月。1 件も無ければ null。 */
  latestMonth: string | null;
}

/** 月次画面のビュー全体 (#64)。 */
export interface EconomyView {
  generatedAt: string;
  /** 月次指標の系列。すべて同じ月グリッドに並ぶ。 */
  monthly: MonthlyPoint[];
  /** 指標ごとの発表状況。画面に「どこまで出ているか」を出す。 */
  coverage: MonthlyCoverage[];
}

/** 予想改定の 1 週分 (spec F-12)。 */
export interface RevisionPoint {
  date: string;
  /** 進行中四半期の blended 増益率。今週 / 先週 / 四半期末の 3 時点。 */
  blendedToday: number | null;
  blendedLastWeek: number | null;
  blendedQuarterEnd: number | null;
  /** 暦年の予想増益率。対象年は date の年 / 年 + 1。 */
  growthCurrentYear: number | null;
  growthNextYear: number | null;
}

/** 画面用ビューの 1 週分 (#8 で生成する)。導出値はビルド時に計算済みにする。 */
export interface ValuationPoint {
  /** "YYYY-MM-DD" (週の基準日)。 */
  date: string;
  /** 欠測は null。NaN を使うと JSON 化で null になり型と実態がずれる。 */
  index: number | null;
  forwardPe: number | null;
  trailingPe: number | null;
  /** 指数 ÷ PER の導出値。実データではない (spec D-11 / D-12)。 */
  forwardEps: number | null;
  trailingEps: number | null;
  /** 1 ÷ forwardPe × 100。 */
  earningsYield: number | null;
  /** 名目 10 年債 − 期待インフレ率 (spec D-22)。 */
  realRate: number | null;
  /** 株式益回り − 実質金利。名目金利ではない (spec F-4)。 */
  yieldSpread: number | null;
  /** 実績 EPS ÷ 基準益回り (spec D-24)。 */
  fairValue: number | null;
  /** 1 − 理論値 ÷ 指数値。正なら割高 (spec D-25)。 */
  overvaluation: number | null;
  /** その時点までの最高値を更新したか (spec F-2)。 */
  isForwardEpsHigh: boolean;
  isTrailingEpsHigh: boolean;
}
