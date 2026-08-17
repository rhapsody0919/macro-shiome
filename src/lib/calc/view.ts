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
  IndexKey,
  CorrelationSummary,
  MacroPoint,
  RevisionPoint,
  ValuationPoint,
  ValuationSeries,
  ValuationView,
} from '../data/types';
import {
  correlation,
  earningsYield,
  epsFromPe,
  fairValue,
  markRecordHighs,
  overvaluation,
  realRate,
  yieldSpread,
} from './derived';
import { fridaysBetween, valueAsOf, valueOn } from './weeks';

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
      overvaluation: overvaluation(fair, indexValue),
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
    hasForwardEps: true,
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
      overvaluation: overvaluation(fair, indexValue),
      isForwardEpsHigh: false,
      isTrailingEpsHigh: false,
    };
  });

  applyRecordHighs(points);

  return {
    points,
    baselines: { pe5y: null, pe10y: null, asOf: null },
    targetYield: resolveTargetYield(config, 'nasdaq100', weeks.at(-1) ?? options.start),
    targetYieldContext: buildTargetYieldContext(options, 'nasdaq100', weeks.at(-1) ?? options.start),
    correlation: toCorrelationSummary(
      weeks,
      points.map((p) => p.index),
      // Forward EPS が無いため実績 EPS との相関を出す。画面でその旨を明示する。
      points.map((p) => p.trailingEps),
      options.today,
    ),
    hasForwardEps: false,
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
    generatedAt: options.today.toISOString(),
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
  }));
}

/**
 * マクロ指標のビュー (spec F-7)。
 *
 * 日次系列を週次 (金曜) に落とす。他のチャートと期間軸を揃えるため。
 * 休場日は直近の営業日まで遡る。
 */
export function buildMacroView(options: BuildViewOptions): MacroPoint[] {
  const { observations } = options;
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));

  return weeks.map((date) => {
    const nominalRate = valueAsOf(series(observations, 'dgs10'), date);
    const breakeven = valueAsOf(series(observations, 't10yie'), date);
    return {
      date,
      vix: valueAsOf(series(observations, 'vix'), date),
      usdjpy: valueAsOf(series(observations, 'usdjpy'), date),
      nominalRate,
      breakeven,
      realRate: realRate(nominalRate, breakeven),
    };
  });
}
