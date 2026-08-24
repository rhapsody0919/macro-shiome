/**
 * データ層の型定義 (ADR-0004: 指標マスタ + 観測値の縦持ち)。
 *
 * 指標は継続的に増える前提。指標ごとに型や構造を作り分けず、
 * マスタ (メタデータ) と観測値 (日付 → 値) に分離する。
 */

/** 更新頻度。日次・週次・月次が混在するため、画面側で粒度を明示する必要がある。 */
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/** 値の単位。同じ number でも意味が違うため取り違えを防ぐ。 */
export type Unit =
  | 'index' // 指数のポイント
  | 'diffusion' // 拡散指数。0 が中立で −100〜+100 に収まる (#94)
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
/**
 * 国債の平均利率の系列 (#222)。
 *
 * 1 回のレスポンスに 16 系列が混ざるため、どれを取るかを固定する。
 * 実際の絞り込み条件は `adapters/treasury.ts` の `AVG_RATE_SERIES`。
 */
export type AvgRateId =
  | 'treasury-avg-rate'
  | 'treasury-avg-rate-bills'
  | 'treasury-avg-rate-notes';

export type IndicatorSource =
  | { adapter: 'fred'; seriesId: string }
  | { adapter: 'factset-pdf'; field: FactsetField }
  | { adapter: 'stockanalysis'; symbol: string; field: 'peRatio' }
  /**
   * 統計ダッシュボード (#129)。**`cycle` と `isSeasonal` の両方が必須。**
   * 片方だけだと同じ月に複数の値が返る (月次/四半期/年度、原数値/季調値が同じ配列に混ざる)。
   */
  | { adapter: 'estat'; indicatorCode: string; cycle: '1'; isSeasonal: '1' | '2' }
  /**
   * e-Stat 統計 API (#160)。**appId が必要**で、統計ダッシュボードとは別経路。
   * 1 つの表に多数の系列が入るため、`tab` / `cat01` / `cat02` をすべて固定する。
   */
  | {
      adapter: 'estat-api';
      statsDataId: string;
      /**
       * 固定する軸 (#160 #226)。**表によって軸の数が違う。**
       *
       * 街角景気は `tab` / `cat01` / `cat02` の 3 つ、法人企業景気予測調査の BSI は
       * `cat01` 〜 `cat05` の 5 つ。**受信側で「応答に出てきた軸がすべて 1 種類か」を
       * 検査する**ので、ここに書き漏らしても黙って別物を掴むことはない。
       */
      axes: Readonly<Record<string, string>>;
      /** 四半期の表か (#226)。日付コードの読み方が変わる。 */
      cycle?: 'monthly' | 'quarterly';
    }
  /**
   * 米財務省 Fiscal Data (#96 #222)。**API キー不要。**
   *
   * `dataset` で 3 つの表を出し分ける。`avg-interest-rate` は 1 回のレスポンスに
   * 16 系列が混ざるため、どの系列かを `series` で固定する (#129 と同じ型)。
   */
  | { adapter: 'treasury'; auction: 'ten-year-bid-to-cover' }
  | { adapter: 'treasury'; avgRate: AvgRateId }
  | { adapter: 'treasury'; debt: 'held-by-public' }
  | { adapter: 'finnhub'; symbol: string }
  /** シラーPER (CAPE)。Robert Shiller 本人が公開する唯一の系列 (#291、ADR-0010)。 */
  | { adapter: 'shiller' };

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
   * 取得できる履歴の上限。制限が無い場合は省略する。
   *
   * FRED の S&P 500 は契約上 10 年、中古住宅販売は NAR の著作権で**直近 13 か月**しか
   * 提供されない (#188)。
   *
   * **提供元より古い観測を持つことがある。** 毎回取得して積み上げるため、時間が経つほど
   * こちらの履歴が長くなる。`pnpm verify` はこの指標について「一次情報に無い過去日付」を
   * 正常として扱う (重なる期間の値は従来どおり照合する)。
   */
  historyLimit?: '13m' | '5y' | '10y';
  /**
   * 検証に使う値の範囲 (#102)。単位から決まる既定値を上書きする。
   *
   * 単位が同じでも自然な範囲が違う指標がある。応札倍率と PER はどちらも `ratio` だが
   * 前者は 2 前後、後者は 20 前後。信用状況指数と株価指数はどちらも `index` だが
   * 前者は負になる。**単位だけで決めると、正常な値を異常と判定してバッチが止まる**。
   */
  range?: { min: number; max: number };
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
  /** 補足 (定義の注意点など)。**開発者向けの覚書**で、画面には出さない。 */
  note?: string;
  /**
   * 提供元が示す実際の単位 (#208)。`unit` だけでは桁が決まらないため別に持つ。
   *
   * `unit: 'index'` は百万ドル・千戸・人・億円・台をすべて覆っており、
   * これだけでは「1,234」が何を指すか読者に伝わらない。**画面の解説に自動で出す。**
   *
   * #198 で `BUSLOANS` を百万ドルと書いたが実際は十億ドルだった。手書きの説明文に
   * 単位を埋め込むと同じ誤りが読者に届くため、ここ 1 か所に持ち、#212 で一次情報と照合する。
   */
  unitLabel?: string;
  /**
   * 提供元が示す単位の文字列を**そのまま**持つ (#212)。FRED 由来の指標のみ。
   *
   * `unitLabel` は読者向けの日本語で、人が書く。こちらは提供元の英語をそのまま写したもので、
   * `pnpm verify` が一次情報と文字列一致で照合する。**日本語と英語を突き合わせる形にすると
   * 表記ゆれで壊れる**ため、照合する側は原文を持つ。
   *
   * #198 で `BUSLOANS` を百万ドルと書いたが実際は十億ドルだった。同じ FRB の系列でも
   * `WALCL` は百万ドルで揃っていない。**桁は指標ごとに確かめるしかない。**
   */
  sourceUnits?: string;
  /**
   * 読者向けの解説 (#208)。省略時は画面に折りたたみを出さない。
   *
   * `note` との違いは**宛先**。`note` は開発者向けで Issue 番号やコード識別子を含むが、
   * こちらは初見の読者が読む。
   */
  explanation?: IndicatorExplanation;
}

/**
 * 初見の読者向けの解説 (#208)。**3 項目に型を揃える。**
 *
 * 自由記述にすると、指標ごとに書く内容も長さもばらつく (既存の `note` は 25〜312 文字)。
 * 何を書くかを型で決めておけば、171 件を別々の PR で書いても読み口が揃う。
 *
 * **単位・出所・系列 ID は書かない。** `unitLabel` と `source` から自動生成する。
 * **評価語も書かない** (#52)。「上がると悪い」と書くと恣意的な閾値を置くのと同じことになる。
 * 定義から決まる基準 (NFCI の 0、DI の 50、FRB の物価目標 2%) だけは `baseline` で示す。
 */
export interface IndicatorExplanation {
  /** これは何か。定義を 1 文で。 */
  what: string;
  /** どう読むか。何と何の差が何を意味するか。 */
  howToRead: string;
  /** 何と一緒に見るか。単独では判断できない指標が多い。省略可。 */
  seeWith?: string;
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
 * 日足の 1 本 (OHLCV、#229)。
 *
 * **調整済み価格 (Tiingo の `adj*`) を保存する。** 生の価格は株式分割で不連続に
 * ジャンプし、カップウィズハンドル・ブルフラッグ (#230 #231) の深さ・期間の判定を
 * 誤らせる。下落率 (#128) は生の終値 (Finnhub) を使っており別物 (ADR-0008)。
 */
export interface OhlcvBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * パターンチャート 1 点分の終値 (#260)。
 *
 * 検出された銘柄のみ、パターンの起点から基準日までの終値系列を持つ。
 * ピボット (主要点) をマーカー表示するための背景の折れ線に使う。
 */
export interface PatternPricePoint {
  date: string;
  close: number;
}

/**
 * OHLCV 観測値ファイル (#229)。
 *
 * `ObservationFile` (スカラー 1 値) とは別の型にする。指標マスタ (ADR-0004) は
 * 1 指標 = 1 系列のスカラー値を前提にしており、1 日に 5 つの値を持つ OHLCV は
 * 質的に違うデータのため、指標マスタには入れない (ADR-0008)。
 */
export interface OhlcvObservationFile {
  /** ETF のティッカー (指標マスタの ID ではない)。 */
  symbol: string;
  /** ISO 8601。 */
  updatedAt: string;
  /** "YYYY-MM-DD" → 日足 1 本。 */
  observations: Record<string, OhlcvBar>;
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
 *
 * イールドスプレッド専用ではなく、PER (#271) など他の指標の過去分布にも使う汎用型。
 */
export interface HistoricalDistribution {
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
    /**
     * 実績 P/E の 5 年 / 10 年平均 (#116)。
     *
     * **Forward とは水準が違う** (実績の方が高い)。NASDAQ-100 には存在しない。
     */
    trailingPe5y: number | null;
    trailingPe10y: number | null;
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
  spreadDistribution: HistoricalDistribution | null;
  /** Forward P/E の過去分布 (#271)。窓・null の扱いは `spreadDistribution` と同じ。 */
  forwardPeDistribution: HistoricalDistribution | null;
  /** 実績 P/E の過去分布 (#271)。窓・null の扱いは `spreadDistribution` と同じ。 */
  trailingPeDistribution: HistoricalDistribution | null;
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

/**
 * シラーPER (CAPE) の系列 (#291、ADR-0010)。
 *
 * `ValuationSeries` (Forward/実績 P/E) とは別の型にする。CAPE は S&P 500 専用の
 * 単一系列で、NASDAQ-100 への切り替えが無く、月次 (週次グリッドに載せない、#64 と同じ理由)
 * のため構造そのものが違う。
 */
export interface ShillerPeSeries {
  /** 月次。"YYYY-MM-01"。`date` にしているのは `buildDistribution` (#271) を型を変えずに再利用するため。 */
  points: Array<{ date: string; value: number | null }>;
  /** 過去分布 (#271 と同じ `HistoricalDistribution`、窓も揃える)。標本不足なら null。 */
  distribution: HistoricalDistribution | null;
}

/** 画面用ビュー全体。 */
export interface ValuationView {
  sp500: ValuationSeries;
  nasdaq100: ValuationSeries;
  /** シラーPER (CAPE)。S&P 500 専用で指数の切り替えに追従しない (#291)。 */
  shillerPe: ShillerPeSeries;
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
   * 潜在成長率 (%、前年同期比)。CBO の潜在 GDP 推計から導出 (#93)。
   *
   * **観測値ではなく推計値**。四半期系列を週次グリッドに前方補完しているため、
   * 四半期の間は同じ値が続く。
   */
  potentialGrowth: number | null;
  /**
   * 10 年債の理論値 (%) = 期待インフレ率 + 潜在成長率 (#93)。
   *
   * 名目 10 年債がこれを超えると、金利が経済の実力を上回り設備投資と個人消費を
   * 抑制する目安になる。**恣意的な閾値ではなく定義から決まる値**。
   */
  treasuryFairValue: number | null;
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
  /**
   * ゴールド (GLD の終値、ドル、#119)。
   *
   * **金の現物価格ではない**。FRED は 2022 年に現物価格の提供を終了したため、
   * 金を裏付けとする ETF の価格で代替している。GLD 1 株はおよそ金 1/10 オンスだが、
   * 信託報酬 (年約 0.4%) の分だけ長期では現物から目減りする。
   */
  gold: number | null;
  /**
   * 日経平均株価 (円、#118)。
   *
   * **S&P 500 と水準を直接比べられない**。通貨も構成銘柄も違う。
   * 米国の動きが世界的なものかを見るために並べる。
   */
  nikkei225: number | null;
  /**
   * 新規求人 (Indeed、2020-02-01 = 100)。労働市場の先行指標 (#87)。
   *
   * **総求人とは別系列**で、新規に掲載された求人だけを数える。
   */
  newJobPostings: number | null;
  /** 金融環境指数 (NFCI)。**0 が平均、正なら引き締まり** (#190)。 */
  nfci: number | null;
  /** 金融環境指数 調整済み (ANFCI)。景気循環の影響を除く (#190)。 */
  anfci: number | null;
  /** 金融ストレス指数 (STLFSI4)。別の連銀・別の手法 (#190)。 */
  financialStress: number | null;
  /** 2年債利回り (%)。政策金利の織り込み (#190)。 */
  twoYearRate: number | null;
  /** SOFR (%)。翌日物の実勢レート (#190)。 */
  sofr: number | null;

  /** 期待インフレ率 5年 BEI (%) (#194)。 */
  breakeven5y: number | null;
  /** 5年先5年期待インフレ率 (%)。FRB が期待の安定を測る (#194)。 */
  breakeven5y5y: number | null;
  /** 継続受給者数 (人)。新規申請と対で再就職の速さを見る (#196)。 */
  continuedClaims: number | null;
  /** FRB バランスシート (百万ドル)。量的引き締めの進捗 (#198)。 */
  fedBalanceSheet: number | null;
  /** イールドカーブ 10年−3か月 (%)。リセッション予測 (#198)。 */
  termSpread3m: number | null;
  /** 3か月 T-Bill (%)。短期金利の起点 (#198)。 */
  tbill3m: number | null;
  /** NASDAQ 総合の前年同月比 (%)。水準は桁が違うため率で揃える (#200)。 */
  nasdaqComposite: number | null;
  /** ダウ平均の前年同月比 (%) (#200)。 */
  djia: number | null;
  /** ドル/ユーロ (#200)。 */
  usdEur: number | null;
  /** 人民元/ドル (#200)。 */
  cnyUsd: number | null;
  /**
   * 国債残高のうち市中保有分 (兆ドル、#222)。日次。
   *
   * **合計ではなく市中保有分**。政府内保有 (社会保障基金など) は市場に出回らないため、
   * 発行圧力を見るならこちら (差は 2026-08 時点で 7.78 兆ドル)。
   */
  federalDebtPublic: number | null;
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
  /**
   * 輸出物価指数の前年同月比 (#98)。米国企業が海外に売るときの価格。
   *
   * **物価の連鎖の上流ではない**。輸入物価と対で見ると交易条件の変化が読める。
   * 輸入だけ上がって輸出が上がらないのは、コスト上昇を転嫁できていない状態。
   */
  exportPrice: number | null;
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
   * 実質可処分所得の総額の前年同月比 (#95)。
   *
   * 1 人当たりと並べると人口増の影響を切り分けられる。
   * 総額が横ばいでも 1 人当たりでは減っていることがある。
   */
  realDisposableTotal: number | null;

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
  /** 中古住宅販売件数。取引量の大半を占める。**直近 13 か月から積み上げ中** (#188)。 */
  existingHomeSales: number | null;
  /** 小売売上 総合の前年同月比 (%)。コアとの差が自動車・ガソリン (#200)。 */
  retailSalesTotal: number | null;
  /** 自動車販売 (百万台)。小売で最も振れる (#200)。 */
  vehicleSales: number | null;
  /** 新築住宅の在庫月数 (か月)。需給バランス (#200)。 */
  newHomeSupply: number | null;
  /** 住宅着工 一戸建て (千戸)。総戸数との差が集合住宅 (#200)。 */
  housingStartsSingle: number | null;
  /** 商工業向け貸出の前年同月比 (%)。信用の量的 side (#198)。 */
  commercialLoans: number | null;
  /** 広義失業率 U-6 (%)。不完全就業を含む (#196)。 */
  u6Rate: number | null;
  /** 労働参加率 (%)。失業率の分母側 (#196)。 */
  participationRate: number | null;
  /** 就業率 (%)。人口に対する就業者の割合 (#196)。 */
  employmentRatio: number | null;
  /** 採用 (千人)。求人が採用に繋がっているか (#196)。 */
  hires: number | null;
  /** 自発的離職 (千人)。労働者の自信を示す (#196)。 */
  quits: number | null;
  /** 週平均労働時間 全産業 (時間) (#196)。 */
  weeklyHoursTotal: number | null;
  /** コア CPI の前年同月比 (%)。食品・エネルギー除く (#194)。 */
  cpiCore: number | null;
  /** コア PCE の前年同月比 (%)。**FRB の物価目標** (#194)。 */
  pceCore: number | null;
  /** 家賃 CPI の前年同月比 (%)。最も粘着的 (#194)。 */
  cpiRent: number | null;
  /** PPI 総合 (商品) の前年同月比 (%)。最終需要の上流 (#194)。 */
  producerPriceAll: number | null;
  /** 設備稼働率 (%)。**水準で読む。長期平均 80% 前後** (#191)。 */
  capacityUtilization: number | null;
  /** 耐久財新規受注の前年同月比 (%)。資本財受注の上位概念 (#191)。 */
  durableGoodsOrders: number | null;
  /** 企業在庫の前年同月比 (%)。在庫循環を見る (#191)。 */
  businessInventories: number | null;
  /** 実質個人消費支出の前年同月比 (%)。実質可処分所得と対で見る (#178)。 */
  realConsumption: number | null;
  /** 日本の完全失業率 (%)。**季節調整済み** (#180)。 */
  jpUnemploymentRate: number | null;
  /** 日本の国内企業物価指数の前年同月比 (%)。**2020年基準** (#180)。 */
  jpProducerPrice: number | null;
  /** 日本の経常収支 (億円)。**季節調整済み** (#174)。 */
  jpCurrentAccount: number | null;
  /** 日本の貿易収支 (億円)。**季節調整済み** (#174)。 */
  jpTradeBalance: number | null;
  /** 日本のマネーストック M2 (億円)。**原数値** (#174)。 */
  jpMoneyStock: number | null;
  /** 日本の実質消費支出の前年同月比 (%)。二人以上の世帯 (#170)。 */
  jpConsumption: number | null;
  /** 日本の実質可処分所得の前年同月比 (%)。勤労者世帯 (#170)。 */
  jpDisposableIncome: number | null;
  /** 日本の平均消費性向 (%)。**季節調整済み** (#170)。 */
  jpPropensityToConsume: number | null;
  /** 日本の鉱工業生産指数。**2020年基準・季節調整済みの水準** (#164)。 */
  jpIndustrialProduction: number | null;
  /** 日本の CPI コアコア (生鮮・エネルギー除く) の前年同月比 (%)。米国のコアと同じ定義 (#202)。 */
  jpCpiCoreCore: number | null;
  /** 日本の鉱工業出荷指数。生産と在庫の間 (#204)。 */
  jpShipments: number | null;
  /** 日本の鉱工業在庫指数。在庫の絶対量 (#204)。 */
  jpInventory: number | null;
  /** 日本の製造工業稼働率指数。**2020年 = 100 の指数** (#204)。 */
  jpOperatingRate: number | null;
  /** 日本の銀行貸出 (億円)。信用の量的 side (#204)。 */
  jpBankLending: number | null;
  /** 日本のマネタリーベース (億円)。日銀が直接供給する通貨量 (#204)。 */
  jpMonetaryBase: number | null;
  /** 日本の総実労働時間指数。**原数値** (#204)。 */
  jpWorkingHours: number | null;
  /** 日本の公共工事受注額 (億円)。財政支出の実行状況 (#204)。 */
  jpPublicWorks: number | null;
  /** 日本の鉱工業在庫率指数。**出荷に対する在庫の比** (#202)。 */
  jpInventoryRatio: number | null;
  /** TOPIX。東証全体・時価総額加重 (#202)。 */
  jpTopix: number | null;
  /** 日本の総消費動向指数 (実質)。家計調査より広い (#202)。 */
  jpConsumptionIndex: number | null;
  /** 日本の CPI コア (生鮮食品を除く総合) の前年同月比 (%)。**2025年基準** (#162)。 */
  jpCpiCore: number | null;
  /** 日本の CPI 総合の前年同月比 (%)。**2025年基準** (#162)。 */
  jpCpi: number | null;
  /** 街角景気の現状判断DI。**季節調整済み、50 が中立** (#160)。 */
  jpWatcherCurrent: number | null;
  /**
   * 企業の景況感 BSI (%ポイント、0 が中立、#226)。**四半期**。
   *
   * 「上昇」と答えた企業の割合 −「下降」の割合。日銀短観は e-Stat に無いため、
   * 公的統計で企業の景況感を見る唯一の経路。**四半期の値はその期の最終月に置く。**
   */
  jpBsiLarge: number | null;
  /** 企業の景況感 BSI (中堅企業)。 */
  jpBsiMid: number | null;
  /** 企業の景況感 BSI (中小企業)。 */
  jpBsiSmall: number | null;
  /** 街角景気の先行き判断DI。**季節調整済み、50 が中立** (#160)。 */
  jpWatcherOutlook: number | null;
  /** 日本の実質賃金指数 (現金給与総額)。**季節調整済み** (#156)。 */
  jpRealWage: number | null;
  /** 日本の新規求人倍率 (倍)。**季節調整済み**。有効求人倍率に先行する (#156)。 */
  jpNewJobRatio: number | null;
  /** 日本の有効求人倍率 (倍)。**季節調整済み** (#156)。 */
  jpJobRatio: number | null;
  /** 日本の輸出物価指数。**2020年基準・円ベース** (#155)。 */
  jpExportPrice: number | null;
  /** 日本の輸入物価指数。**2020年基準・円ベース** (#155)。 */
  jpImportPrice: number | null;
  /** 日本の景気動向指数 (先行)。**2020年基準・原数値** (#154)。 */
  jpDiLeading: number | null;
  /** 日本の景気動向指数 (一致)。**2020年基準・原数値** (#154)。 */
  jpDiCoincident: number | null;
  /** 日本の景気動向指数 (遅行)。**2020年基準・原数値** (#154)。 */
  jpDiLagging: number | null;
  /** 日本の新設住宅着工戸数 (総戸数)。**戸・季節調整済み年率換算** (#129)。 */
  jpHousingStarts: number | null;
  /** 日本の新設住宅着工戸数 (持家)。**戸・季調値、年率換算ではない** (#129)。 */
  jpHousingStartsOwned: number | null;
  /** 日本の新設住宅着工戸数 (貸家)。**戸・季調値、年率換算ではない** (#129)。 */
  jpHousingStartsRented: number | null;

  // --- 水準 ---
  /** 求人件数 (JOLTS、千件)。労働省の公式統計。 */
  jobOpenings: number | null;
  /**
   * 10 年債入札の応札倍率 (#96)。応札額 ÷ 落札額で、**低いほど買い手が弱い**。
   *
   * 入札は月 1 回で日付も不定のため、その月の入札結果としてこの月に載せる。
   * 財政収支 (発行額) の下流にあたる。
   */
  bidToCover: number | null;
  /**
   * NY連銀景気指数 (拡散指数)。0 が「改善と悪化が同数」(#94)。
   *
   * **当月分が当月中旬に出る**ため、月次では最も発表が早い。ただし対象は
   * ニューヨーク連銀管内の製造業のみで、全米を代表しない。
   */
  nyFedSurvey: number | null;
  /** フィラデルフィア連銀景気指数 (拡散指数)。対象は第3地区の製造業のみ。 */
  phillyFedSurvey: number | null;
  /**
   * S&P500 の前年同日比 (%) (#287)。
   *
   * フィラデルフィア連銀景気指数と並べ、景況感が株価に先行するかを見る。
   * FRED は S&P/Dow Jones 系列を直近 10 年分しか提供しないため、他の月次系列より表示期間が短い。
   */
  sp500Yoy: number | null;
  /**
   * 10 年債利回り (%) の国際比較 (#97)。3 か国とも OECD 由来の同じ定義の月次系列。
   *
   * **日次では取れない**ため、日次の `nominalRate` より 2 か月ほど遅れる。
   * 米国の金利上昇が世界的な現象か固有要因かを判別するために並べる。
   */
  usTenYearMonthly: number | null;
  /** 日本の 10 年債利回り (%)。 */
  jpTenYear: number | null;
  /** ドイツの 10 年債利回り (%)。 */
  deTenYear: number | null;
  /** 財政収支 (百万ドル)。負が赤字。 */
  federalDeficit: number | null;
  /**
   * 国債の平均利率 (%) (#222)。**発行済み国債が実際に払っている金利。**
   *
   * 市場で取引されている利回りとは別物。10年債利回りがこれを上回っている間は、
   * 借り換えが進むほど利払いが増える。
   */
  treasuryAvgRate: number | null;
  /** 国債の平均利率 (短期債、%)。政策金利にほぼ連動する。 */
  treasuryAvgRateBills: number | null;
  /** 国債の平均利率 (中期債、%)。残高が最も大きく全体を左右する。 */
  treasuryAvgRateNotes: number | null;
  /** 失業率 (%)。水準そのものが意味を持つ。 */
  unemploymentRate: number | null;
  /** 貯蓄率 (%)。低下は貯蓄の取り崩しを示す。 */
  savingsRate: number | null;
  /**
   * 個人貯蓄額 (10億ドル、季節調整済み年率) の前年同月比 (#95)。
   *
   * **貯蓄率だけでは足りない**。率は所得が減っても上がるため、
   * 「取り崩している」のか「所得が減っただけ」なのかが判別できない。
   */
  personalSaving: number | null;
  /** ミシガン大学消費者信頼感指数 (1966:Q1=100)。 */
  consumerSentiment: number | null;
  /**
   * VISA裁量的消費指数 (100が基準、#294)。
   *
   * レジャー・外食・旅行など生活必需でない消費の指数。非裁量的消費 (`visaNonDiscretionary`)
   * と対で見ることで、生活必需品への支出まで削られているのか、余裕がある部分だけを
   * 削っているのかを判別する。
   */
  visaDiscretionary: number | null;
  /** VISA非裁量的消費指数 (100が基準、#294)。生活必需品への消費。 */
  visaNonDiscretionary: number | null;
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
  /**
   * 四半期の予想増益率 (#117)。
   *
   * **暦年と違って対象が動く**。「翌四半期」は四半期が進むと別の四半期を指すため、
   * 同じ線が同じ対象を追い続けない。暦年 (年内は固定) とは別の軸で読む。
   */
  growthNextQuarter: number | null;
  growthQuarterAfterNext: number | null;
}

/** 下落率チャートの 1 資産 (#128)。 */
export interface DrawdownAsset {
  /** 指標マスタの ID。 */
  id: string;
  name: string;
  /** 表示グループ (主要資産 / セクター / コモディティ / 各国)。 */
  group: string;
  /**
   * 最高値 (ドル/株)。**観測開始以降の最大値**であって史上最高値ではない。
   *
   * Stock Bot から引き継いだ起点 (2024-11-28) の最高値と、その後の観測の最大値。
   */
  high: number | null;
  /** 直近の下落率 (%) とその時点。 */
  latest: { date: string; drawdown: number } | null;
  /** 週次の下落率。引き継いだ履歴と、取得値から計算した分が繋がっている。 */
  points: Array<{ date: string; drawdown: number | null }>;
  /**
   * SPY (S&P 500) に対する相対パフォーマンス (%) の直近値 (#274)。
   *
   * プラスは SPY をアウトパフォーム、マイナスはアンダーパフォームを意味する。
   * 観測が無ければ null (下落率と違い、引き継いだ履歴が無いため蓄積を待つしかない)。
   */
  latestRelativeStrength: { date: string; value: number } | null;
  /**
   * SPY に対する相対パフォーマンスの時系列 (#274)。
   *
   * 資産価格と SPY 価格を最初の共通観測日で揃え、以降の比率の変化を % で示す。
   * **下落率と違い、引き継いだ履歴 (Stock Bot) には価格が無いため計算できず、
   * 観測が貯まった期間しか値を持たない**。SPY 自身は恒等的に 0 になる。
   */
  relativeStrengthPoints: Array<{ date: string; value: number | null }>;
}

/** 下落率のビュー (#128)。 */
export interface DrawdownView {
  /** 最高値の起点。史上最高値ではないことを画面に出すために持つ。 */
  seedStart: string | null;
  /**
   * 対SPY (相対強度) の起点 (#289)。
   *
   * `seedStart` (下落率の起点、2024-11-28) とは別物。相対強度は引き継いだ履歴に
   * 価格が無く計算できないため、観測が貯まった最初の日から始まる。データの蓄積状況で
   * 変わるため、画面には固定値を書かずここから動的に表示する。
   */
  relativeStrengthStart: string | null;
  /** 引き継げなかった資産と理由。画面に出して欠落を隠さない。 */
  excluded: Array<{ id: string; reason: string }>;
  assets: DrawdownAsset[];
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
  /**
   * 理論値と比べる指数値 (#110)。**EPS の元になった終値と同一時点**にする。
   *
   * S&P 500 の実績 EPS は FactSet 終値 ÷ FactSet 実績 PER で作る。その終値は
   * レポート日の**前営業日**の値なので、レポート日の指数と比べると 1 営業日ずれる。
   * 実測で最大 2.7% の差があり、割高率の水準 (4% 前後) の半分以上になっていた。
   * NASDAQ-100 は指数そのものから EPS を作るので `index` と同じ値になる。
   */
  fairValueBasis: number | null;
  /** 1 − 理論値 ÷ 比較基準。正なら割高 (spec D-25)。 */
  overvaluation: number | null;
  /** その時点までの最高値を更新したか (spec F-2)。 */
  isForwardEpsHigh: boolean;
  isTrailingEpsHigh: boolean;
}

/**
 * 更新履歴の 1 件 (#240)。
 *
 * `note` / `explanation` (#208) と同じ「宛先の違い」を適用する。こちらは常に読者向けで、
 * Issue 番号・コード識別子・評価語・マークダウン装飾を含めない (`changelog.test.ts` で固定)。
 */
export interface ChangelogEntry {
  /** 公開日 (YYYY-MM-DD)。この日付で新しい順に並べる。 */
  date: string;
  /** 何が増えた/変わったか。読者が読む 1 文。 */
  title: string;
}

/**
 * CHoCH (Change of Character) の検出結果 (#268)。
 *
 * カップウィズハンドル (#230)・ダブルボトム (#256)・逆三尊 (#258)・
 * High Tight Flag (#231) を置き換えた N 日高値抜け (#264) を、さらに Smart Money
 * Concepts (SMC/ICT) の CHoCH に置き換える。N 日高値抜けは機械的な直近 N 日の
 * 高値比較で、下落トレンドの構造そのものは見ていなかった。CHoCH は「下落トレンド
 * (安値切り下げ) の途中で、終値が直近の戻り高値 (前回の高値) を上抜けたか」を見る、
 * トレンド転換シグナルとしてより意味のある定義。詳細な根拠は `choch.ts` 先頭の
 * コメントを参照。
 *
 * **BOS (Break of Structure、トレンド継続) は対象外**、強気 CHoCH のみ。
 */
export interface BreakoutDetection {
  /** 1 つ目の安値 (下落構造の起点)。 */
  firstLowDate: string;
  firstLowPrice: number;
  /** 戻り高値 (下落トレンド中の「前回の高値」)。これを終値が上抜けたことを検出する。 */
  priorHighDate: string;
  priorHighPrice: number;
  /** 2 つ目の安値 (1 つ目より低い、下落継続を示す)。 */
  secondLowDate: string;
  secondLowPrice: number;
  /** 前回の高値を終値が上抜けた日。 */
  breakoutDate: string;
  breakoutPrice: number;
  /** スイング判定に使った前後本数。 */
  swingLength: number;
}

/** ブレイクアウトチャートの 1 銘柄 (#264)。 */
export interface BreakoutAsset {
  /** ティッカー。指標マスタを経由しないため symbol を直接持つ (#229 と同じ設計、ADR-0008)。 */
  symbol: string;
  name: string;
  /** 検出されていなければ null (0 件は正常な状態、#230/#231 と同じ設計)。 */
  detection: BreakoutDetection | null;
  /**
   * 検出時のみ、CHoCH の構造全体 (`firstLowDate` 以降) と直近 90 営業日のうち
   * 広い方の終値系列 (#260 #266 #268)。
   */
  priceSeries: PatternPricePoint[] | null;
}

/**
 * ブレイクアウトのビュー全体 (#264)。
 *
 * `assets` は対象銘柄すべてを含む (検出の有無に関わらず)。ビューが存在すれば
 * 「検出を試みて 0 件だった」ことを表せるため、取得・計算の失敗とは区別できる
 * (#102 / #131 / #230 / #231 と同じ「緑だが歯抜け」を避ける設計)。
 */
export interface BreakoutView {
  generatedAt: string;
  assets: BreakoutAsset[];
}

/**
 * 警告シグナル (#279)。
 *
 * コード側で機械的に判定する。`basis: 'zero-line'` は逆イールド・NFCI のように
 * 定義そのものから決まる境界 (#52 の原則)、`basis: 'percentile'` は過去5年分布の
 * 上位/下位10% (十分位) を機械的な基準にする。**LLM に新しい警告を発明させない** —
 * ここに無い条件は画面に出ない。
 */
export interface WarningSignal {
  id: string;
  label: string;
  value: number;
  basis: 'zero-line' | 'percentile';
  /** basis が 'percentile' のときの分位 (0〜100)。'zero-line' なら null。 */
  percentile: number | null;
  date: string;
  /**
   * LLM が書いた説明文 (#279)。**数値を含まない** — 数値は上の `value`/`percentile`
   * をコードが直接描画する。生成前・生成失敗時は null (無いことを隠さない)。
   */
  note: string | null;
}

/**
 * セクター/ETFのハイライト (#279)。
 *
 * 「狙い目」を推奨文にせず、複数シグナルの重なりという事実の提示に留める
 * (下落率が深い方から1/3以内・SPYに対する相対強度がプラス・CHoCH検出、のうち2つ以上)。
 */
export interface SectorHighlight {
  id: string;
  name: string;
  drawdown: number;
  /** SPYに対する相対強度 (%)。算出できていなければ null (#274)。 */
  relativeStrength: number | null;
  hasBreakout: boolean;
  /** 満たしたシグナルの数 (2以上が対象)。 */
  signalCount: number;
  /** LLM が書いた説明文。数値を含まない (WarningSignal と同じ扱い)。 */
  note: string | null;
}

/**
 * AI要約のビュー (#279)。
 *
 * 日次バッチ内で生成し `data/views/summary.json` に保存する。`warnings`/`highlights`
 * はネットワーク不要でコードだけから作れる。`economyState`/各 `note` は
 * Cloudflare Workers AI (ADR-0009) の呼び出しに依存するため、トークン未設定や
 * 呼び出し失敗時は null のまま保存する (バッチ全体は失敗させない)。
 */
export interface SummaryView {
  generatedAt: string;
  /** 経済状態の要約文。数値を含まない。生成できていなければ null。 */
  economyState: string | null;
  /**
   * `economyState` の材料にした指標の件数 (#283)。
   *
   * 要約文自体は数値を含まない設計 (#279) のため、根拠の厚みだけを事実として示す。
   * `economyState` が null (未生成) なら 0。
   */
  economyStateFactCount: number;
  warnings: WarningSignal[];
  highlights: SectorHighlight[];
}

/**
 * BOS (Break of Structure) の検出結果 (#272)。
 *
 * CHoCH (`BreakoutDetection`) と対になる。上昇トレンド (安値切り上げ) の途中で、
 * 終値が直近の戻り高値を上抜けたことを検出する。CHoCH がトレンド転換の兆候であるのに
 * 対し、BOS は既に上昇トレンドが継続していることの確認シグナル。詳細な根拠は
 * `bos.ts`/`structure-break.ts` 先頭のコメントを参照。
 */
export interface BosDetection {
  /** 1 つ目の安値。 */
  firstLowDate: string;
  firstLowPrice: number;
  /** 戻り高値。これを終値が上抜けたことを検出する。 */
  priorHighDate: string;
  priorHighPrice: number;
  /** 2 つ目の安値 (1 つ目より高い、上昇継続を示す)。 */
  secondLowDate: string;
  secondLowPrice: number;
  /** 戻り高値を終値が上抜けた日。 */
  breakoutDate: string;
  breakoutPrice: number;
  /** スイング判定に使った前後本数。 */
  swingLength: number;
}

/** BOS チャートの 1 銘柄 (#272)。 */
export interface BosAsset {
  /** ティッカー。指標マスタを経由しないため symbol を直接持つ (#229 と同じ設計、ADR-0008)。 */
  symbol: string;
  name: string;
  /** 検出されていなければ null (0 件は正常な状態、#268 と同じ設計)。 */
  detection: BosDetection | null;
  /**
   * 検出時のみ、BOS の構造全体 (`firstLowDate` 以降) と直近 90 営業日のうち
   * 広い方の終値系列 (#260 #266 #268 #272)。
   */
  priceSeries: PatternPricePoint[] | null;
}

/**
 * BOS のビュー全体 (#272)。
 *
 * `assets` は対象銘柄すべてを含む (検出の有無に関わらず)。ビューが存在すれば
 * 「検出を試みて 0 件だった」ことを表せるため、取得・計算の失敗とは区別できる
 * (#102 / #131 / #230 / #231 / #268 と同じ「緑だが歯抜け」を避ける設計)。
 */
export interface BosView {
  generatedAt: string;
  assets: BosAsset[];
}

