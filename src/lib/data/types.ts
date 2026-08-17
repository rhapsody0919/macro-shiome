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

/** 欠測の理由。画面で区別して表示する (screens 共通の状態)。 */
export type GapReason =
  /** FactSet の休刊週。異常ではない。 */
  | 'publication-break'
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
  /** 指数と Forward EPS の相関 (spec F-5)。 */
  correlation: CorrelationSummary;
  /** Forward EPS を持つか。NASDAQ-100 は取得経路が無いため false (screens C-2)。 */
  hasForwardEps: boolean;
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
