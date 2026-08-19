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
  DrawdownAsset,
  DrawdownView,
  IndexKey,
  CorrelationSummary,
  EconomyView,
  MacroPoint,
  MarketDailyPoint,
  MonthlyCoverage,
  MonthlyPoint,
  RevisionPoint,
  SpreadDistribution,
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
import { fridaysBetween, valueAsOf, valueOn, weekdaysBetween } from './weeks';
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
    spreadDistribution: buildSpreadDistribution(points, options.today),
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
    spreadDistribution: buildSpreadDistribution(points, options.today),
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
 * イールドスプレッドの過去分布 (#52)。
 *
 * 窓は 5 年に固定する。期間フィルターに追従させると基準が動いてしまい、
 * 「今が過去に比べてどこか」の比較にならない。
 */
const SPREAD_WINDOW_YEARS = 5;

function buildSpreadDistribution(
  points: readonly ValuationPoint[],
  today: Date,
): SpreadDistribution | null {
  const from = new Date(
    Date.UTC(today.getUTCFullYear() - SPREAD_WINDOW_YEARS, today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);

  const within = points.filter((point) => point.date >= from);
  const stats = distribution(within.map((point) => point.yieldSpread));
  if (stats === null) return null;

  // 直近値は窓の中の最後の観測。窓外の古い値を「直近」として出さない。
  const latest = within.filter((point) => point.yieldSpread !== null).at(-1);
  if (latest === undefined) return null;

  const latestValue = latest.yieldSpread as number;
  const percentile = percentileRank(
    within.map((point) => point.yieldSpread),
    latestValue,
  );
  if (percentile === null) return null;

  return {
    years: SPREAD_WINDOW_YEARS,
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
export function buildMacroView(options: BuildViewOptions): MacroPoint[] {
  const { observations } = options;
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));
  // 四半期系列なので週ごとに作り直さず 1 度だけ計算する。
  const potentialGrowthSeries = quarterlyGrowth(series(observations, 'potential-gdp'));

  return weeks.map((date) => {
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
    };
  });
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
export function buildDrawdownView(
  options: BuildViewOptions & {
    seed: DrawdownSeed;
    assets: ReadonlyArray<{ id: string; group: string }>;
    names: Readonly<Record<string, string>>;
  },
): DrawdownView {
  const { observations, seed, assets: definitions, names } = options;
  const weeks = fridaysBetween(options.start, options.today.toISOString().slice(0, 10));

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
    let high = seeded?.seedHigh ?? 0;
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

  const seedDates = Object.values(seed.assets).flatMap((a) => Object.keys(a.drawdown));
  return {
    seedStart: seedDates.length === 0 ? null : seedDates.sort()[0],
    excluded,
    assets,
  };
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
    retailSales: yoy('retail-sales-core', month),
    // 水準そのものが意味を持つ (40 時間が基準)。前年比にすると読めなくなる。
    manufacturingHours: level('manufacturing-hours', month),
    industrialProduction: yoy('industrial-production', month),
    newOrdersConsumerGoods: yoy('new-orders-consumer-goods', month),
    newOrdersCapitalGoods: yoy('new-orders-capital-goods', month),
    buildingPermits: level('building-permits', month),
    housingStarts: level('housing-starts', month),
    newHomeSales: level('new-home-sales', month),
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

  return {
    monthly,
    coverage,
  };
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
  'retail-sales-core',
  'manufacturing-hours',
  'industrial-production',
  'new-orders-consumer-goods',
  'new-orders-capital-goods',
  'building-permits',
  'housing-starts',
  'new-home-sales',
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
 * **マクロビューと分ける理由**は `MarketDailyPoint` の注記のとおり。
 */
export function buildMarketDailyView(options: BuildViewOptions): MarketDailyPoint[] {
  const { observations } = options;
  const days = weekdaysBetween(options.start, options.today.toISOString().slice(0, 10));

  return days.map((date) => {
    const nominalRate = valueAsOf(series(observations, 'dgs10'), date);
    const breakeven = valueAsOf(series(observations, 't10yie'), date);
    return {
      date,
      nikkei225: valueAsOf(series(observations, 'nikkei225'), date),
      vix: valueAsOf(series(observations, 'vix'), date),
      usdjpy: valueAsOf(series(observations, 'usdjpy'), date),
      wti: valueAsOf(series(observations, 'wti'), date),
      dollarIndex: valueAsOf(series(observations, 'dollar-index'), date),
      // 履歴ページから 50 営業日ぶんを遡って取り込んである (#135)。
      gold: valueAsOf(series(observations, 'etf-gld'), date),
      nominalRate,
      breakeven,
      realRate: realRate(nominalRate, breakeven),
      fedFundsRate: valueAsOf(series(observations, 'fed-funds-rate'), date),
    };
  });
}
