/**
 * 画面用ビューの生成 (plan 3-4)。
 *
 * 観測値と設定から導出値を計算して埋める。**クライアントで再計算しない**ことで、
 * 計算ロジックを 1 か所に集約し、定義のずれが各所に散らばるのを防ぐ。
 */
import type { Observations } from '../adapters/fred';
import { resolveTargetYield, resolveTargetYieldEntry } from '../data/indicators';
import type {
  AppConfig,
  BosAsset,
  BosView,
  BreakoutAsset,
  BreakoutView,
  DrawdownAsset,
  DrawdownView,
  IndexKey,
  CorrelationSummary,
  EconomyView,
  MacroPoint,
  MonthlyCoverage,
  MonthlyPoint,
  OhlcvBar,
  PatternPricePoint,
  RevisionPoint,
  HistoricalDistribution,
  ValuationPoint,
  ValuationSeries,
  ValuationView,
} from '../data/types';
import {
  correlation,
  distribution,
  drawdown,
  earningsYield,
  epsFromPe,
  fairValue,
  markRecordHighs,
  overvaluation,
  percentileRank,
  realRate,
  treasuryFairValue,
  yearOverYear,
  yieldSpread,
} from './derived';
import { fridaysBetween, sameDayLastYear, valueAsOf, valueOn, weekdaysBetween } from './weeks';
import { toSortedBars, type SortedBars } from './bars';
import { detectChoch } from './choch';
import { detectBos } from './bos';
import { roundViewNumbers } from './round';
import { DAILY_SERIES, type DailyKey, type DailyPoint, type DailyViewName } from '../data/daily-series';
import { latestMonthWithValue, monthsBetween, valueForMonth, yearAgo } from './months';

/** 指標 ID → 観測値。存在しない指標は空として扱う。 */
export type ObservationMap = Readonly<Record<string, Observations>>;

export interface BuildViewOptions {
  observations: ObservationMap;
  config: AppConfig;
  /** 週次系列の開始日 "YYYY-MM-DD"。 */
  start: string;
  /** 基準日。現在時刻に依存させないため引数で受け取る。 */
  today: Date;
}

function series(map: ObservationMap, id: string): Observations {
  return map[id] ?? {};
}

/** 相関を表示用の形に落とす。 */
function toCorrelationSummary(
  dates: readonly string[],
  indexValues: readonly (number | null)[],
  epsValues: readonly (number | null)[],
  today: Date,
): CorrelationSummary {
  const cutoff = (months: number): string => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate()),
    );
    return date.toISOString().slice(0, 10);
  };

  const within = (from: string) => {
    const xs: (number | null)[] = [];
    const ys: (number | null)[] = [];
    for (const [i, date] of dates.entries()) {
      if (date < from) continue;
      xs.push(indexValues[i]);
      ys.push(epsValues[i]);
    }
    return correlation(xs, ys);
  };

  return {
    halfYear: within(cutoff(6)),
    oneYear: within(cutoff(12)),
    all: correlation(indexValues, epsValues),
  };
}

/**
 * S&P 500 のビューを組み立てる。
 *
 * EPS の逆算には **FactSet の終値**を使う (PER と同一時点。FRED の指数だと時点がずれる)。
 * チャートに出す指数は FRED の値を使う (休場日の補完が効き、連続性がある)。
 */
function buildSp500Series(options: BuildViewOptions, weeks: readonly string[]): ValuationSeries {
  const { observations, config } = options;

  const index = series(observations, 'sp500');
  const factsetClose = series(observations, 'sp500-close-factset');
  const forwardPe = series(observations, 'sp500-forward-pe');
  const trailingPe = series(observations, 'sp500-trailing-pe');
  const pe5y = series(observations, 'sp500-forward-pe-5y-avg');
  const pe10y = series(observations, 'sp500-forward-pe-10y-avg');
  const trailingPe5y = series(observations, 'sp500-trailing-pe-5y-avg');
  const trailingPe10y = series(observations, 'sp500-trailing-pe-10y-avg');
  const dgs10 = series(observations, 'dgs10');
  const t10yie = series(observations, 't10yie');

  const points: ValuationPoint[] = weeks.map((date) => {
    const indexValue = valueAsOf(index, date);
    // 週次系列は発行日ちょうどで引く。遡ると休刊週が前週の値で埋まり欠測が見えなくなる。
    const fwdPe = valueOn(forwardPe, date);
    const trlPe = valueOn(trailingPe, date);
    const close = valueOn(factsetClose, date);

    const fwdEps = epsFromPe(close, fwdPe);
    const trlEps = epsFromPe(close, trlPe);
    const eYield = earningsYield(fwdPe);
    const real = realRate(valueAsOf(dgs10, date), valueAsOf(t10yie, date));
    const target = resolveTargetYield(config, 'sp500', date);
    const fair = fairValue(trlEps, target);

    return {
      date,
      index: indexValue,
      forwardPe: fwdPe,
      trailingPe: trlPe,
      forwardEps: fwdEps,
      trailingEps: trlEps,
      earningsYield: eYield,
      realRate: real,
      yieldSpread: yieldSpread(eYield, real),
      fairValue: fair,
      // **EPS の元になった FactSet 終値と比べる** (#110)。指数 (金曜) と比べると
      // 1 営業日ずれた 2 つの終値を突き合わせることになる。
      fairValueBasis: close,
      overvaluation: overvaluation(fair, close),
      isForwardEpsHigh: false,
      isTrailingEpsHigh: false,
    };
  });

  applyRecordHighs(points);

  const latestBaselineDate = latestDateWithValue(pe5y, weeks);

  return {
    points,
    baselines: {
      pe5y: latestBaselineDate === null ? null : (pe5y[latestBaselineDate] ?? null),
      pe10y: latestBaselineDate === null ? null : (pe10y[latestBaselineDate] ?? null),
      trailingPe5y: latestBaselineDate === null ? null : (trailingPe5y[latestBaselineDate] ?? null),
      trailingPe10y:
        latestBaselineDate === null ? null : (trailingPe10y[latestBaselineDate] ?? null),
      asOf: latestBaselineDate,
    },
    targetYield: resolveTargetYield(config, 'sp500', weeks.at(-1) ?? options.start),
    targetYieldContext: buildTargetYieldContext(options, 'sp500', weeks.at(-1) ?? options.start),
    correlation: toCorrelationSummary(
      weeks,
      points.map((p) => p.index),
      points.map((p) => p.forwardEps),
      options.today,
    ),
    spreadDistribution: buildDistribution(points, (p) => p.yieldSpread, options.today),
    forwardPeDistribution: buildDistribution(points, (p) => p.forwardPe, options.today),
    trailingPeDistribution: buildDistribution(points, (p) => p.trailingPe, options.today),
    hasForwardEps: true,
    // FactSet の過去号 (PDF) を遡って取得できるため蓄積待ちにならない。
    accumulationNote: null,
  };
}

/**
 * NASDAQ-100 のビュー。
 *
 * **Forward PER の無料取得経路が無い**ため Forward EPS を持たない (spec D-17)。
 * 画面では「蓄積中」ではなく「取得経路が無い」として区別して表示する (screens C-2)。
 */
function buildNasdaqSeries(options: BuildViewOptions, weeks: readonly string[]): ValuationSeries {
  const { observations, config } = options;

  const index = series(observations, 'nasdaq100');
  const qqqPe = series(observations, 'qqq-trailing-pe');
  const dgs10 = series(observations, 'dgs10');
  const t10yie = series(observations, 't10yie');

  const points: ValuationPoint[] = weeks.map((date) => {
    const indexValue = valueAsOf(index, date);
    // QQQ の PER は日次で取れるため、休場日を考慮して直近値を採る。
    const trlPe = valueAsOf(qqqPe, date);
    // NASDAQ-100 は FactSet の終値が無いので、指数そのもので逆算する。
    const trlEps = epsFromPe(indexValue, trlPe);
    const real = realRate(valueAsOf(dgs10, date), valueAsOf(t10yie, date));
    const target = resolveTargetYield(config, 'nasdaq100', date);
    const fair = fairValue(trlEps, target);
    // Forward PER が無いため、益回りは実績ベースで出す。
    const eYield = earningsYield(trlPe);

    return {
      date,
      index: indexValue,
      forwardPe: null,
      trailingPe: trlPe,
      forwardEps: null,
      trailingEps: trlEps,
      earningsYield: eYield,
      realRate: real,
      yieldSpread: yieldSpread(eYield, real),
      fairValue: fair,
      // NASDAQ-100 は指数そのものから EPS を作るので、比較基準も指数で揃う (#110)。
      fairValueBasis: indexValue,
      overvaluation: overvaluation(fair, indexValue),
      isForwardEpsHigh: false,
      isTrailingEpsHigh: false,
    };
  });

  applyRecordHighs(points);

  return {
    points,
    // NASDAQ-100 は FactSet の平均が存在しない。QQQ 経由では現在値しか取れない。
    baselines: { pe5y: null, pe10y: null, trailingPe5y: null, trailingPe10y: null, asOf: null },
    targetYield: resolveTargetYield(config, 'nasdaq100', weeks.at(-1) ?? options.start),
    targetYieldContext: buildTargetYieldContext(options, 'nasdaq100', weeks.at(-1) ?? options.start),
    correlation: toCorrelationSummary(
      weeks,
      points.map((p) => p.index),
      // Forward EPS が無いため実績 EPS との相関を出す。画面でその旨を明示する。
      points.map((p) => p.trailingEps),
      options.today,
    ),
    spreadDistribution: buildDistribution(points, (p) => p.yieldSpread, options.today),
    // NASDAQ-100 は Forward PER の取得経路が無いため常に null (自然に null になる)。
    forwardPeDistribution: buildDistribution(points, (p) => p.forwardPe, options.today),
    trailingPeDistribution: buildDistribution(points, (p) => p.trailingPe, options.today),
    hasForwardEps: false,
    // 実績 PER は QQQ 経由でしか取れず、stockanalysis.com は現在値しか出さない
    // (src/lib/adapters/stockanalysis.ts)。backfill.ts も FactSet 専用で遡れない。
    accumulationNote:
      '実績 PER は連動 ETF (QQQ) 経由でしか取れず、提供元が現在値しか出さないため過去に遡れない。',
  };
}

/**
 * 基準益回りの妥当性を判断するための文脈を作る (#46)。
 *
 * 基準益回りを実質金利に自動連動させる案は採用しなかった。実質金利がマイナスの局面で
 * 理論値が発散するため (2022-02 で割高率 −431% になる)。代わりに設定時からの乖離を示し、
 * 見直しの判断を人に委ねる。
 */
function buildTargetYieldContext(
  options: BuildViewOptions,
  index: IndexKey,
  latestDate: string,
): ValuationSeries['targetYieldContext'] {
  const entry = resolveTargetYieldEntry(options.config, index, latestDate);
  const current = realRate(
    valueAsOf(series(options.observations, 'dgs10'), latestDate),
    valueAsOf(series(options.observations, 't10yie'), latestDate),
  );
  const atSetting = entry.realRateAtSetting ?? null;

  return {
    realRateAtSetting: atSetting,
    currentRealRate: current,
    drift: current === null || atSetting === null ? null : current - atSetting,
    // 実質金利で説明されない部分。裁量で置いているリスクプレミアムに相当する。
    riskPremium: atSetting === null ? null : entry.value - atSetting,
  };
}

/**
 * 過去分布における現在値の位置 (#52、#271 で PER にも横展開)。
 *
 * 窓は 5 年に固定する。期間フィルターに追従させると基準が動いてしまい、
 * 「今が過去に比べてどこか」の比較にならない。
 */
const DISTRIBUTION_WINDOW_YEARS = 5;

function buildDistribution(
  points: readonly ValuationPoint[],
  extract: (point: ValuationPoint) => number | null,
  today: Date,
): HistoricalDistribution | null {
  const from = new Date(
    Date.UTC(
      today.getUTCFullYear() - DISTRIBUTION_WINDOW_YEARS,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);

  const within = points.filter((point) => point.date >= from);
  const stats = distribution(within.map(extract));
  if (stats === null) return null;

  // 直近値は窓の中の最後の観測。窓外の古い値を「直近」として出さない。
  const latest = within.filter((point) => extract(point) !== null).at(-1);
  if (latest === undefined) return null;

  const latestValue = extract(latest) as number;
  const percentile = percentileRank(within.map(extract), latestValue);
  if (percentile === null) return null;

  return {
    years: DISTRIBUTION_WINDOW_YEARS,
    mean: stats.mean,
    sd: stats.sd,
    n: stats.n,
    latest: latestValue,
    latestPercentile: percentile,
    latestDate: latest.date,
  };
}

/** 過去最高値のフラグを埋める (spec F-2)。 */
function applyRecordHighs(points: ValuationPoint[]): void {
  const forwardHighs = markRecordHighs(points.map((p) => p.forwardEps));
  const trailingHighs = markRecordHighs(points.map((p) => p.trailingEps));
  for (const [i, point] of points.entries()) {
    point.isForwardEpsHigh = forwardHighs[i];
    point.isTrailingEpsHigh = trailingHighs[i];
  }
}

/** 値を持つ最も新しい観測日を返す。 */
function latestDateWithValue(
  observations: Observations,
  weeks: readonly string[],
): string | null {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (observations[weeks[i]] !== undefined) return weeks[i];
  }
  return null;
}

export function buildValuationView(options: BuildViewOptions): ValuationView {
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));

  return {
    sp500: buildSp500Series(options, weeks),
    nasdaq100: buildNasdaqSeries(options, weeks),
  };
}

/**
 * 予想改定の系列を組み立てる (spec F-12)。
 *
 * forward 12M EPS と並べない。forward 12M は四半期が進むとロールするため、
 * 改定が無くても増益トレンド下では上昇し、改定と混同される (週あたり約 0.3% のバイアス)。
 */
export function buildRevisionSeries(options: BuildViewOptions): RevisionPoint[] {
  const { observations } = options;
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));

  return weeks.map((date) => ({
    date,
    blendedToday: valueOn(series(observations, 'sp500-blended-growth-today'), date),
    blendedLastWeek: valueOn(series(observations, 'sp500-blended-growth-last-week'), date),
    blendedQuarterEnd: valueOn(series(observations, 'sp500-blended-growth-quarter-end'), date),
    growthCurrentYear: valueOn(series(observations, 'sp500-growth-cy-current'), date),
    growthNextYear: valueOn(series(observations, 'sp500-growth-cy-next'), date),
    growthNextQuarter: valueOn(series(observations, 'sp500-growth-next-quarter'), date),
    growthQuarterAfterNext: valueOn(
      series(observations, 'sp500-growth-quarter-after-next'),
      date,
    ),
  }));
}

/**
 * その月の観測値を返す (#96)。月内の日付が不定な系列に使う。
 *
 * `valueForMonth` は「月初 (YYYY-MM-01) ちょうど」を見るので、
 * **入札のように日付が月ごとに動く系列には使えない**。同じ月に複数あれば最後の 1 件。
 */
export function latestInMonth(observations: Observations, month: string): number | null {
  const prefix = month.slice(0, 7);
  const dates = Object.keys(observations)
    .filter((date) => date.startsWith(prefix))
    .sort();
  const last = dates.at(-1);
  return last === undefined ? null : observations[last];
}

/**
 * 四半期の水準系列から前年同期比 (%) の系列を作る (#93)。
 *
 * 観測日は四半期の初日 (1/1・4/1・7/1・10/1) に揃っているため、
 * **年だけ 1 つ戻した日付**が 1 年前の同じ四半期になる。
 * 1 年前が無い期は結果に含めない (欠測として扱う)。
 */
export function quarterlyGrowth(observations: Observations): Observations {
  const growth: Record<string, number> = {};
  for (const [date, value] of Object.entries(observations)) {
    const previous = observations[`${Number.parseInt(date.slice(0, 4), 10) - 1}${date.slice(4)}`];
    if (previous === undefined) continue;
    const rate = yearOverYear(value, previous);
    if (rate !== null) growth[date] = rate;
  }
  return growth;
}

/**
 * 四半期系列を週次グリッドで引くときの遡り幅 (日)。
 *
 * 四半期の初日に値が立つので、期末の週では 90 日ほど遡る必要がある。
 * 発表ラグを足して 120 日にしている。これ以上広げると、系列が止まっても
 * 古い値を使い続けて欠測に気付けなくなる。
 */
const QUARTERLY_LOOKBACK_DAYS = 120;

/**
 * マクロ指標のビュー (spec F-7)。
 *
 * 日次系列を週次 (金曜) に落とす。他のチャートと期間軸を揃えるため。
 * 休場日は直近の営業日まで遡る。
 */
/**
 * 日次系列の前年同月比 (#200)。
 *
 * **水準が桁違いの指数を同じ軸に載せないため**に使う (#118)。NASDAQ 総合 26,331 と
 * ダウ 53,463 は 2 倍差で、水準のままでは片方が潰れる。指数化は基準日が恣意的になるので、
 * 前年同日比にして揃える。
 *
 * 1 年前が休場なら直前の営業日まで遡る (`valueAsOf` と同じ扱い)。
 */
function yoyAsOf(
  observations: ObservationMap,
  indicatorId: string,
  date: string,
): number | null {
  const points = series(observations, indicatorId);
  const current = valueAsOf(points, date);
  if (current === null) return null;

  const previous = valueAsOf(points, sameDayLastYear(date));
  if (previous === null || previous === 0) return null;
  return (current / previous - 1) * 100;
}

export function buildMacroView(options: BuildViewOptions): MacroPoint[] {
  const { observations } = options;
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));
  // 四半期系列なので週ごとに作り直さず 1 度だけ計算する。
  const potentialGrowthSeries = quarterlyGrowth(series(observations, 'potential-gdp'));

  // 表示は 2 桁 (#218)。**入力が既に 2 桁**なので、丸めても検証 5 の再計算との差は
  // 0.000000 のまま (実測)。許容差を緩める必要が無い。
  return roundViewNumbers(weeks.map((date) => {
    const nominalRate = valueAsOf(series(observations, 'dgs10'), date);
    const breakeven = valueAsOf(series(observations, 't10yie'), date);
    const potentialGrowth = valueAsOf(potentialGrowthSeries, date, QUARTERLY_LOOKBACK_DAYS);
    return {
      date,
      vix: valueAsOf(series(observations, 'vix'), date),
      usdjpy: valueAsOf(series(observations, 'usdjpy'), date),
      nominalRate,
      breakeven,
      realRate: realRate(nominalRate, breakeven),
      potentialGrowth,
      treasuryFairValue: treasuryFairValue(breakeven, potentialGrowth),
      termSpread: valueAsOf(series(observations, 't10y2y'), date),
      // 週次系列。金曜が休みでも直近の値を採る。
      mortgageRate: valueAsOf(series(observations, 'mortgage-rate-30y'), date),
      initialClaims: valueAsOf(series(observations, 'initial-claims'), date),
      creditConditions: valueAsOf(series(observations, 'credit-conditions'), date),
      hySpread: valueAsOf(series(observations, 'hy-spread'), date),
      igSpread: valueAsOf(series(observations, 'ig-spread'), date),
      fedFundsRate: valueAsOf(series(observations, 'fed-funds-rate'), date),
      wti: valueAsOf(series(observations, 'wti'), date),
      dollarIndex: valueAsOf(series(observations, 'dollar-index'), date),
      // 日本の休場日は欠測になるため、直近の営業日まで遡る。
      nikkei225: valueAsOf(series(observations, 'nikkei225'), date),
      // Finnhub の当日終値 (#133)。週次で 1 点しか取れないので遡り幅は他と揃える。
      // stockanalysis の `Previous Close` は当日ではなく 1 つ前の取引日を指しており、
      // 保存キーが 1 取引日ずれていたため切り替えた。
      gold: valueAsOf(series(observations, 'etf-gld'), date),
      newJobPostings: valueAsOf(series(observations, 'new-job-postings'), date),
      // 金融環境指数は週次。0 が平均のスケールで 3 本とも揃う (#190)。
      nfci: valueAsOf(series(observations, 'nfci'), date),
      anfci: valueAsOf(series(observations, 'anfci'), date),
      financialStress: valueAsOf(series(observations, 'financial-stress'), date),
      // 週次グリッドでも型を満たす。表示は日次ビュー側で行う (#190)。
      twoYearRate: valueAsOf(series(observations, 'dgs2'), date),
      sofr: valueAsOf(series(observations, 'sofr'), date),
      breakeven5y: valueAsOf(series(observations, 'breakeven-5y'), date),
      breakeven5y5y: valueAsOf(series(observations, 'breakeven-5y5y'), date),
      // 週次。新規申請と同じグリッドに乗る (#196)。
      continuedClaims: valueAsOf(series(observations, 'continued-claims'), date),
      // 週次。金利 (価格) とは別の経路で市場に効く (#198)。
      fedBalanceSheet: valueAsOf(series(observations, 'fed-balance-sheet'), date),
      termSpread3m: valueAsOf(series(observations, 'term-spread-3m'), date),
      tbill3m: valueAsOf(series(observations, 'tbill-3m'), date),
      nasdaqComposite: yoyAsOf(observations, 'nasdaq-composite', date),
      djia: yoyAsOf(observations, 'djia', date),
      usdEur: valueAsOf(series(observations, 'usd-eur'), date),
      cnyUsd: valueAsOf(series(observations, 'cny-usd'), date),
      federalDebtPublic: valueAsOf(series(observations, 'federal-debt-public'), date),
    };
  }));
}

/** 引き継いだ下落率の履歴。ETF の過去価格は無料で取れないため再生成できない (#128)。 */
export interface DrawdownSeed {
  assets: Record<string, { seedHigh: number; drawdown: Record<string, number> }>;
}

/**
 * 下落率のビュー (#128)。
 *
 * **最高値は導出値**。観測を全部残し、そこから累積最大を計算する。
 * Stock Bot はセルに上書きしていたため異常値を掴むと復旧できなかった (VGT の実例)。
 * ここでは観測を 1 点消せば直る。
 *
 * 引き継いだ履歴の範囲は下落率をそのまま使い、それ以降は観測値から計算する。
 * 履歴には価格が無いため、繋ぎ目は `seedHigh` (引き継いだ最高値) で揃える。
 */
/**
 * 観測開始時点の最高値を求める (#149)。
 *
 * `seedHigh` は**引き継いだ時点 (現在) の最大**なので、観測期間の先頭から当てると
 * 「後から付いた高値で過去の点を割る」ことになる。ただし**いつも遡及になるわけではない**。
 * 最高値が観測開始より前に付いていれば、その時点で既に最高値だったのだから正しい。
 *
 * Stock Bot が下落率 0 を記録した最後の日 = 最高値を更新した日。実測では
 * **35 資産中 23 が観測開始 (2026-06-08) より前**で、遡及になるのは 12 資産だけだった。
 *
 * - 最高値が観測開始より前 → `seedHigh` をそのまま起点にする (正しい)
 * - 観測期間の中で更新 → その日の終値と記録された下落率から逆算する
 *
 * ```
 * 最高値 = 終値 ÷ (1 − 下落率 / 100)
 * ```
 *
 * **逆算は最小限にとどめる。** Stock Bot の下落率は我々の終値と同じ価格から出ていない
 * (逆算した最高値が単調非減少にならず、SPY で 49 日中 27 日が違反、幅 3.94%)。
 * 全期間に当てると誤差が最高値に乗るため、遡及が実際に起きる資産の起点にだけ使う。
 */
function startingHigh(
  prices: Observations,
  firstObserved: string | undefined,
  seeded: { seedHigh: number; drawdown: Record<string, number> } | undefined,
): number {
  if (seeded === undefined) return 0;
  if (firstObserved === undefined) return seeded.seedHigh;

  // 下落率 0 = その日の価格が最高値。最後に 0 だった日が最高値を付けた日。
  const peakDates = Object.entries(seeded.drawdown)
    .filter(([, value]) => value <= 0.001)
    .map(([date]) => date)
    .sort();
  const peak = peakDates.at(-1);

  // 記録が無い場合も含め、最高値が観測開始より前なら遡及にならない。
  if (peak === undefined || peak < firstObserved) return seeded.seedHigh;

  const recorded = seeded.drawdown[firstObserved];
  if (recorded === undefined || recorded >= 100) return 0;
  return prices[firstObserved] / (1 - recorded / 100);
}

export function buildDrawdownView(
  options: BuildViewOptions & {
    seed: DrawdownSeed;
    assets: ReadonlyArray<{ id: string; group: string }>;
    names: Readonly<Record<string, string>>;
  },
): DrawdownView {
  const { observations, seed, assets: definitions, names } = options;

  // **日次グリッドで、起点は引き継いだ履歴の開始日** (#166)。
  //
  // 週次グリッド (2016 起点) では 524 点のうち非 null が 89 点しかなく、
  // データが存在しない 2016〜2024 の 435 点を運んでいた。日次にして起点を
  // seed に合わせると **450 点・約 1,276 KB** で、週次の 1,486 KB より小さく
  // 解像度は 5 倍になる。観測は毎日入る (#136) ので週次では週内の動きが消えていた。
  const seedDates = Object.values(seed.assets).flatMap((a) => Object.keys(a.drawdown));
  const seedStart = seedDates.length === 0 ? null : seedDates.sort()[0];
  const start = seedStart !== null && seedStart > options.start ? seedStart : options.start;
  const weeks = weekdaysBetween(start, options.today.toISOString().slice(0, 10));

  const excluded: Array<{ id: string; reason: string }> = [];
  const assets: DrawdownAsset[] = [];

  for (const { id, group } of definitions) {
    const prices = series(observations, id);
    const seeded = seed.assets[id];
    if (seeded === undefined && Object.keys(prices).length === 0) {
      excluded.push({ id, reason: '履歴も観測も無い' });
      continue;
    }

    // **最高値は観測から積み上げる**。過去を消せば直せる形にする。
    //
    // グリッド点の値だけを見てはいけない (#138)。日次バッチ (#136) では観測が
    // 毎営業日入るため、週次グリッドの金曜だけを見ると**その週の途中で付けた高値を
    // 取りこぼす**。最高値が低く出ると下落率も小さく出る。
    const observedDates = Object.keys(prices).sort();
    let cursor = 0;
    // 起点は**観測開始時点の最高値**であって、全期間の最高値ではない (#149)。
    // `seedHigh` は引き継いだ時点 (= 現在) の最大なので、それを観測期間の先頭から
    // 当てると**後から付いた高値で過去の点を割る**ことになる。実測で 22/105 件が
    // 1pt 超ずれ、最大 6.64pt だった。
    let high = startingHigh(prices, observedDates[0], seeded);
    const points: Array<{ date: string; drawdown: number | null }> = [];

    for (const date of weeks) {
      // このグリッド日までに観測されたものをすべて最高値に反映する。
      while (cursor < observedDates.length && observedDates[cursor] <= date) {
        high = Math.max(high, prices[observedDates[cursor]]);
        cursor += 1;
      }

      const price = valueAsOf(prices, date);
      if (price !== null) {
        points.push({ date, drawdown: drawdown(high, price) });
        continue;
      }
      // 観測がまだ無い週は引き継いだ履歴を使う。
      const inherited = seeded?.drawdown[date];
      points.push({ date, drawdown: inherited ?? null });
    }

    // 表示する最高値はグリッドの外の観測も含める。
    // グリッド最終点より後に取れた観測 (#125 の状況) が最高値を更新していても、
    // 「最高値」として嘘をつかないため。各点の下落率はその時点までの最高値で出す。
    let observedHigh = high;
    while (cursor < observedDates.length) {
      observedHigh = Math.max(observedHigh, prices[observedDates[cursor]]);
      cursor += 1;
    }

    const withValue = points.filter((point) => point.drawdown !== null);
    const last = withValue.at(-1);
    assets.push({
      id,
      name: names[id] ?? id,
      group,
      high: observedHigh > 0 ? observedHigh : null,
      latest: last === undefined ? null : { date: last.date, drawdown: last.drawdown as number },
      points,
    });
  }

  // 表示は 2 桁 (#218)。導出した点だけが全桁で、日次で積み上がるほど差が広がっていた。
  return roundViewNumbers({ seedStart, excluded, assets });
}

/**
 * チャート表示用の最低日数 (営業日、#266)。
 *
 * 検出条件のスイング判定本数とは別物。上抜けた高値の日から切り出すと表示区間が
 * ほぼ空になって読みにくかった (実データで GLD/CORN が 2 点しか表示されない事例で発覚)。
 * これを下限に、構造全体 (#268: 1 つ目の安値以降) が入るよう必要ならさらに広げる。
 */
const CHART_DISPLAY_MIN_DAYS = 90;

/**
 * `bars` の末尾 (基準日) までの終値系列を、CHoCH の構造全体 (`fromDate` = 1 つ目の安値)
 * と直近 `CHART_DISPLAY_MIN_DAYS` 本のどちらか広い方で切り出す (#260 #266 #268)。
 */
function slicePriceSeriesForChart(bars: SortedBars, fromDate: string): PatternPricePoint[] {
  const structureStartIndex = bars.findIndex((b) => b.date === fromDate);
  const recentStartIndex = Math.max(0, bars.length - CHART_DISPLAY_MIN_DAYS);
  const startIndex =
    structureStartIndex === -1 ? recentStartIndex : Math.min(structureStartIndex, recentStartIndex);
  return bars.slice(startIndex).map(({ date, bar }) => ({ date, close: bar.close }));
}

/**
 * ブレイクアウト (CHoCH) のビュー (#268)。カップウィズハンドル (#230)・
 * ダブルボトム (#256)・逆三尊 (#258)・High Tight Flag (#231)・N 日高値抜け (#264)
 * を置き換える。
 *
 * 指標マスタを経由しない (#229/ADR-0008 と同じ理由。OHLCV は指標マスタが前提とする
 * 1 系列 = スカラー値と型が合わない)。`assets` は対象銘柄すべてを含め、検出できなかった
 * 銘柄も `detection: null` として残す。**ビューが生成されていること自体**が
 * 「検出を試みて 0 件だった」ことの証明になる (#102 と同じ「緑だが検証していない」を避ける設計)。
 */
export function buildBreakoutView(options: {
  symbols: ReadonlyArray<{ symbol: string; name: string }>;
  ohlcvObservations: Readonly<Record<string, Readonly<Record<string, OhlcvBar>>>>;
  generatedAt: string;
  /** スイング判定の前後本数。省略時は `detectChoch` の既定値 (#268)。 */
  swingLength?: number;
}): BreakoutView {
  const { symbols, ohlcvObservations, generatedAt, swingLength } = options;
  const assets: BreakoutAsset[] = symbols.map(({ symbol, name }) => {
    const bars = toSortedBars(ohlcvObservations[symbol] ?? {});
    const detection = detectChoch(bars, swingLength);
    const priceSeries =
      detection === null ? null : slicePriceSeriesForChart(bars, detection.firstLowDate);
    return { symbol, name, detection, priceSeries };
  });
  return roundViewNumbers({ generatedAt, assets });
}

/**
 * BOS (Break of Structure) のビュー (#272)。`buildBreakoutView` (#268) と対になる。
 * トレンド転換 (CHoCH) ではなく、トレンド継続の確認シグナルを検出する。
 */
export function buildBosView(options: {
  symbols: ReadonlyArray<{ symbol: string; name: string }>;
  ohlcvObservations: Readonly<Record<string, Readonly<Record<string, OhlcvBar>>>>;
  generatedAt: string;
  /** スイング判定の前後本数。省略時は `detectBos` の既定値 (#268 と同じ)。 */
  swingLength?: number;
}): BosView {
  const { symbols, ohlcvObservations, generatedAt, swingLength } = options;
  const assets: BosAsset[] = symbols.map(({ symbol, name }) => {
    const bars = toSortedBars(ohlcvObservations[symbol] ?? {});
    const detection = detectBos(bars, swingLength);
    const priceSeries =
      detection === null ? null : slicePriceSeriesForChart(bars, detection.firstLowDate);
    return { symbol, name, detection, priceSeries };
  });
  return roundViewNumbers({ generatedAt, assets });
}

/**
 * 月次指標のビュー (#64 / #66)。
 *
 * **週次グリッドに載せない**。月次データを週次に落とすと同じ値が 4〜5 週続き、
 * 「先週から動いていない」のか「月次だから動かない」のか読み手が判別できなくなる。
 *
 * 物価・労働・所得は前年同月比。単位や基準年が指標ごとに違い、水準では比較できないため。
 * 貯蓄率と消費者信頼感は水準そのものが意味を持つので変換しない。
 */
export function buildEconomyView(options: BuildViewOptions): EconomyView {
  const { observations } = options;
  const months = monthsBetween(options.start, options.today.toISOString().slice(0, 10));

  /** 前年同月比。単位が違う指標を同じ軸で比べるために使う。 */
  const yoy = (id: string, month: string): number | null =>
    yearOverYear(
      valueForMonth(series(observations, id), month),
      valueForMonth(series(observations, id), yearAgo(month)),
    );

  /** 水準そのまま。貯蓄率のように水準が意味を持つ指標に使う。 */
  const level = (id: string, month: string): number | null =>
    valueForMonth(series(observations, id), month);

  const monthly: MonthlyPoint[] = months.map((month) => ({
    month,
    importPrice: yoy('import-price', month),
    exportPrice: yoy('export-price', month),
    producerPrice: yoy('producer-price', month),
    cpi: yoy('cpi', month),
    pce: yoy('pce-price', month),
    payrolls: yoy('payrolls', month),
    employmentLevel: yoy('employment-level', month),
    fullTimeEmployment: yoy('full-time-employment', month),
    realIncomeExTransfer: yoy('real-income-ex-transfer', month),
    realDisposablePerCapita: yoy('real-disposable-income-per-capita', month),
    realDisposableTotal: yoy('real-disposable-income', month),
    // 総合とコアの差が自動車・ガソリンの寄与を示す (#200)。
    retailSalesTotal: yoy('retail-sales-total', month),
    vehicleSales: level('vehicle-sales', month),
    newHomeSupply: level('new-home-supply', month),
    housingStartsSingle: level('housing-starts-single', month),
    // 信用の量。スプレッド (価格) が落ち着いても量が縮んでいれば資金は取れていない (#198)。
    commercialLoans: yoy('commercial-loans', month),
    // 労働市場の質。失業率だけでは「探すのをやめた」のか区別できない (#196)。
    u6Rate: level('u6-rate', month),
    participationRate: level('participation-rate', month),
    employmentRatio: level('employment-ratio', month),
    hires: level('hires', month),
    quits: level('quits', month),
    weeklyHoursTotal: level('weekly-hours-total', month),
    // FRB が見る物価。総合は食品・エネルギーで振れる (#194)。
    cpiCore: yoy('cpi-core', month),
    pceCore: yoy('pce-core', month),
    cpiRent: yoy('cpi-rent', month),
    producerPriceAll: yoy('producer-price-all', month),
    // 稼働率は水準で読む。前年同月比にすると「80% を割った」が見えない (#191)。
    capacityUtilization: level('capacity-utilization', month),
    durableGoodsOrders: yoy('durable-goods-orders', month),
    businessInventories: yoy('business-inventories', month),
    // 所得と対で見る。片方だけでは買い控えか余力喪失かを区別できない (#95 #178)。
    realConsumption: yoy('real-consumption', month),
    retailSales: yoy('retail-sales-core', month),
    // 水準そのものが意味を持つ (40 時間が基準)。前年比にすると読めなくなる。
    manufacturingHours: level('manufacturing-hours', month),
    industrialProduction: yoy('industrial-production', month),
    newOrdersConsumerGoods: yoy('new-orders-consumer-goods', month),
    newOrdersCapitalGoods: yoy('new-orders-capital-goods', month),
    buildingPermits: level('building-permits', month),
    housingStarts: level('housing-starts', month),
    newHomeSales: level('new-home-sales', month),
    // FRED は直近 13 か月しか出さない。毎日取得して積み上げる (#188)。
    existingHomeSales: level('existing-home-sales', month),
    // 公表値をそのまま出す。指数が小数 1 桁なので導出すると丸めでずれる (#180)。
    jpUnemploymentRate: level('jp-unemployment-rate', month),
    jpProducerPrice: level('jp-producer-price', month),
    // 原数値だと符号が変わるほど振れるため季調値 (#174)。
    jpCurrentAccount: level('jp-current-account', month),
    jpTradeBalance: level('jp-trade-balance', month),
    jpMoneyStock: level('jp-money-stock', month),
    // 実質で出す。名目だと消費が増えたのか値上がりしただけかを判別できない (#170)。
    jpConsumption: level('jp-consumption', month),
    jpDisposableIncome: level('jp-disposable-income', month),
    jpPropensityToConsume: level('jp-propensity-to-consume', month),
    // 前年同月比にせず水準で出す (#164)。公表の前年同月比系列が無く、
    // 指数が小数 1 桁なので導出すると丸め誤差が出る。
    jpIndustrialProduction: level('jp-industrial-production', month),
    // 生産 → 出荷 → 在庫 の関係が在庫循環そのもの (#204)。
    jpShipments: level('jp-shipments', month),
    jpInventory: level('jp-inventory', month),
    jpOperatingRate: level('jp-operating-rate', month),
    jpBankLending: level('jp-bank-lending', month),
    jpMonetaryBase: level('jp-monetary-base', month),
    jpWorkingHours: level('jp-working-hours', month),
    jpPublicWorks: level('jp-public-works', month),
    // 米国のコアと同じ定義。日本のコアは生鮮のみ除くため国際比較にはこちら (#202)。
    jpCpiCoreCore: level('jp-cpi-core-core', month),
    jpInventoryRatio: level('jp-inventory-ratio', month),
    jpTopix: level('jp-topix', month),
    jpConsumptionIndex: level('jp-consumption-index', month),
    // **公表されている前年同月比をそのまま出す** (#162)。日本の CPI 指数は小数 1 桁しか
    // 公表されず、そこから導出すると丸めで公表値とずれる (2026-06 は 1.50% と 1.6%)。
    // 米国は指数が小数 3 桁あるため `yoy()` で導出している。経路は違うが値は正しい。
    jpCpiCore: level('jp-cpi-core', month),
    jpCpi: level('jp-cpi', month),
    // 街角景気は DI (50 が中立)。景気動向指数とは基準が違うので同じ図に載せない (#160)。
    jpWatcherCurrent: level('jp-watcher-current', month),
    // 四半期。その期の最終月にだけ値が入る (#226)。
    jpBsiLarge: level('jp-bsi-large', month),
    jpBsiMid: level('jp-bsi-mid', month),
    jpBsiSmall: level('jp-bsi-small', month),
    jpWatcherOutlook: level('jp-watcher-outlook', month),
    // 賞与月の跳ねを避けるため季調値を採っている (#156)。
    jpRealWage: level('jp-real-wage', month),
    // 求人倍率は同じ単位 (倍) で、新規が先行・有効が一致という関係が読める。
    jpNewJobRatio: level('jp-new-job-ratio', month),
    jpJobRatio: level('jp-job-ratio', month),
    // 輸出入物価は同じ基準・同じ円ベースなので重ねてよい (#155)。
    jpExportPrice: level('jp-export-price', month),
    jpImportPrice: level('jp-import-price', month),
    // 景気動向指数は 3 本とも同じ基準・同じ単位なので重ねてよい (#154)。
    jpDiLeading: level('jp-di-leading', month),
    jpDiCoincident: level('jp-di-coincident', month),
    jpDiLagging: level('jp-di-lagging', month),
    // 日本は水準のまま出す。総戸数だけ年率換算なので内訳と同じ図に載せない (#129)。
    jpHousingStarts: level('jp-housing-starts', month),
    jpHousingStartsOwned: level('jp-housing-starts-owned', month),
    jpHousingStartsRented: level('jp-housing-starts-rented', month),
    jobOpenings: level('job-openings', month),
    // 入札日は月内で不定なので、その月に 1 件でもあればその値を載せる。
    bidToCover: latestInMonth(series(observations, 'ten-year-bid-to-cover'), month),
    // 拡散指数。水準そのものが意味を持つ (0 が中立) ため前年同月比にしない。
    nyFedSurvey: level('ny-fed-survey', month),
    phillyFedSurvey: level('philly-fed-survey', month),
    // 金利は水準そのものが意味を持つ。前年同月比にすると読めなくなる。
    usTenYearMonthly: level('us-10y-monthly', month),
    jpTenYear: level('jp-10y', month),
    deTenYear: level('de-10y', month),
    federalDeficit: level('federal-deficit', month),
    // 月末時点の値なので、応札倍率と同じくその月に 1 件あれば載せる (#222)。
    treasuryAvgRate: latestInMonth(series(observations, 'treasury-avg-rate'), month),
    treasuryAvgRateBills: latestInMonth(series(observations, 'treasury-avg-rate-bills'), month),
    treasuryAvgRateNotes: latestInMonth(series(observations, 'treasury-avg-rate-notes'), month),
    unemploymentRate: level('unemployment-rate', month),
    savingsRate: level('savings-rate', month),
    // 貯蓄率と対で見る。金額は前年同月比に揃える (水準は桁が違って並べられない)。
    personalSaving: yoy('personal-saving', month),
    consumerSentiment: level('consumer-sentiment', month),
  }));

  // 発表ラグは指標ごとに違うため、系列単位で「どこまで出ているか」を持つ。
  const coverage: MonthlyCoverage[] = MONTHLY_INDICATORS.map((indicatorId) => ({
    indicatorId,
    latestMonth:
      // 入札は月内の日付が不定なので、月初ちょうどを見る通常の判定では拾えない (#96)。
      indicatorId === 'ten-year-bid-to-cover'
        ? (months.findLast(
            (month) => latestInMonth(series(observations, indicatorId), month) !== null,
          ) ?? null)
        : latestMonthWithValue(months, series(observations, indicatorId)),
  }));

  // 表示は 2 桁 (#218)。前年同月比は全桁で保存されており、gzip で 42% ぶん無駄だった。
  return roundViewNumbers({
    monthly,
    coverage,
  });
}

/** 月次画面が使う指標。発表状況の表示に使う。 */
const MONTHLY_INDICATORS = [
  'import-price',
  'export-price',
  'producer-price',
  'cpi',
  'pce-price',
  'payrolls',
  'employment-level',
  'full-time-employment',
  'real-income-ex-transfer',
  'real-disposable-income-per-capita',
  'real-disposable-income',
  'real-consumption',
  'retail-sales-total',
  'vehicle-sales',
  'new-home-supply',
  'housing-starts-single',
  'commercial-loans',
  'u6-rate',
  'participation-rate',
  'employment-ratio',
  'hires',
  'quits',
  'weekly-hours-total',
  'cpi-core',
  'pce-core',
  'cpi-rent',
  'producer-price-all',
  'capacity-utilization',
  'durable-goods-orders',
  'business-inventories',
  'retail-sales-core',
  'manufacturing-hours',
  'industrial-production',
  'new-orders-consumer-goods',
  'new-orders-capital-goods',
  'building-permits',
  'housing-starts',
  'new-home-sales',
  'existing-home-sales',
  'jp-unemployment-rate',
  'jp-producer-price',
  'jp-current-account',
  'jp-trade-balance',
  'jp-money-stock',
  'jp-consumption',
  'jp-disposable-income',
  'jp-propensity-to-consume',
  'jp-industrial-production',
  'jp-shipments',
  'jp-inventory',
  'jp-operating-rate',
  'jp-bank-lending',
  'jp-monetary-base',
  'jp-working-hours',
  'jp-public-works',
  'jp-cpi-core-core',
  'jp-inventory-ratio',
  'jp-topix',
  'jp-consumption-index',
  'jp-cpi-core',
  'jp-cpi',
  'jp-watcher-current',
  'jp-watcher-outlook',
  'jp-real-wage',
  'jp-new-job-ratio',
  'jp-job-ratio',
  'jp-export-price',
  'jp-import-price',
  'jp-di-leading',
  'jp-di-coincident',
  'jp-di-lagging',
  'jp-housing-starts',
  'jp-housing-starts-owned',
  'jp-housing-starts-rented',
  'job-openings',
  'ten-year-bid-to-cover',
  'ny-fed-survey',
  'philly-fed-survey',
  'us-10y-monthly',
  'jp-10y',
  'de-10y',
  'federal-deficit',
  'unemployment-rate',
  'savings-rate',
  'personal-saving',
  'consumer-sentiment',
] as const;

/**
 * 日次グリッドの価格系列 (#137)。
 *
 * 週次グリッドは「週足に丸める」のではなく「金曜の値だけを拾う」実装なので、
 * **週内の動きがそもそも図に出ていなかった**。価格系列は FRED から日次で
 * 取得済み (日経平均 19,181 点など) なので、取得を変えずに密度を上げられる。
 *
 * **マクロビューと分ける理由**: あちらは月次・週次の系列も抱えており、日次グリッドに
 * 載せると値が動かない日の点が増えるだけで情報が増えない。さらに経済ページの
 * サマリーも読むため、そちらまで巨大になる (実測で 425 KB → 1,348 KB)。
 *
 * **さらにページ別に分けてある** (#168)。系列の割り当ては `daily-series.ts`。
 */
export function buildDailyView(
  options: BuildViewOptions,
  view: DailyViewName,
): DailyPoint[] {
  const { observations } = options;
  const days = weekdaysBetween(options.start, options.today.toISOString().slice(0, 10));
  const wanted = new Set<string>(DAILY_SERIES[view]);

  // 表示は 2 桁 (#218)。為替だけは 4 桁で残す (2 桁だと動きが消える)。
  return roundViewNumbers(days.map((date) => {
    const at = (id: string) => valueAsOf(series(observations, id), date);
    const nominalRate = at('dgs10');
    const breakeven = at('t10yie');

    // 系列ごとの取り出し方。**ページ別のビューでも同じ定義を使う**ため 1 か所に置く。
    const all: Record<DailyKey, number | null> = {
      nikkei225: at('nikkei225'),
      vix: at('vix'),
      usdjpy: at('usdjpy'),
      wti: at('wti'),
      dollarIndex: at('dollar-index'),
      // 履歴ページから 50 営業日ぶんを遡って取り込んである (#135)。
      gold: at('etf-gld'),
      nominalRate,
      breakeven,
      realRate: realRate(nominalRate, breakeven),
      fedFundsRate: at('fed-funds-rate'),
      // 日次で取れているのに週次グリッドに載せていた 4 系列 (#166)。
      termSpread: at('t10y2y'),
      hySpread: at('hy-spread'),
      igSpread: at('ig-spread'),
      newJobPostings: at('new-job-postings'),
      // 短期金利。政策金利の織り込みと実勢 (#190)。
      twoYearRate: at('dgs2'),
      sofr: at('sofr'),
      // 市場が織り込む物価。実績ではなく先を見る (#194)。
      breakeven5y: at('breakeven-5y'),
      breakeven5y5y: at('breakeven-5y5y'),
      // 3か月は政策金利にほぼ連動する。逆転は「政策が引き締めすぎ」を直接示す (#198)。
      termSpread3m: at('term-spread-3m'),
      tbill3m: at('tbill-3m'),
      // 水準は桁が違うため前年同月比で揃える (#118 #200)。
      nasdaqComposite: yoyAsOf(observations, 'nasdaq-composite', date),
      djia: yoyAsOf(observations, 'djia', date),
      usdEur: at('usd-eur'),
      cnyUsd: at('cny-usd'),
      // 兆ドル。市中保有分だけ (#222)。
      federalDebtPublic: at('federal-debt-public'),
    };

    const point: DailyPoint = { date };
    for (const key of Object.keys(all) as DailyKey[]) {
      if (wanted.has(key)) point[key] = all[key];
    }
    return point;
  }));
}

