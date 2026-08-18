/**
 * テスト用のフィクスチャ。
 *
 * `ValuationPoint` は 14 フィールドあり、テストごとに全部書き下すとフィールドが
 * 増えるたび全テストを直すことになる。既定値をここに集約する。
 */
import type { RevisionPoint, ValuationPoint, ValuationSeries } from '@/lib/data/types';

/** 全項目が欠測の 1 週。必要な項目だけ overrides で埋める。 */
export function valuationPoint(
  date: string,
  overrides: Partial<ValuationPoint> = {},
): ValuationPoint {
  return {
    date,
    index: null,
    forwardPe: null,
    trailingPe: null,
    forwardEps: null,
    trailingEps: null,
    earningsYield: null,
    realRate: null,
    yieldSpread: null,
    fairValue: null,
    fairValueBasis: null,
    overvaluation: null,
    isForwardEpsHigh: false,
    isTrailingEpsHigh: false,
    ...overrides,
  };
}

/** 点列以外を既定で埋めた系列。 */
export function valuationSeries(
  points: ValuationPoint[],
  overrides: Partial<Omit<ValuationSeries, 'points'>> = {},
): ValuationSeries {
  return {
    points,
    baselines: { pe5y: null, pe10y: null, trailingPe5y: null, trailingPe10y: null, asOf: null },
    targetYield: 3.67,
    targetYieldContext: {
      realRateAtSetting: null,
      currentRealRate: null,
      drift: null,
      riskPremium: null,
    },
    correlation: {
      halfYear: { kind: 'insufficient', n: 0 },
      oneYear: { kind: 'insufficient', n: 0 },
      all: { kind: 'insufficient', n: 0 },
    },
    spreadDistribution: null,
    hasForwardEps: true,
    accumulationNote: null,
    ...overrides,
  };
}

/**
 * 全項目が欠測の予想改定 1 週。
 *
 * `ValuationPoint` と同じ理由でここに集約する。テストごとに書き下すと、
 * フィールドが増えるたび全テストを直すことになる。
 */
export function revisionPoint(
  date: string,
  overrides: Partial<RevisionPoint> = {},
): RevisionPoint {
  return {
    date,
    blendedToday: null,
    blendedLastWeek: null,
    blendedQuarterEnd: null,
    growthCurrentYear: null,
    growthNextYear: null,
    growthNextQuarter: null,
    growthQuarterAfterNext: null,
    ...overrides,
  };
}
