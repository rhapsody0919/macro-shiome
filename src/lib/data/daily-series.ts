/**
 * 日次ビューの系列をページ別に分ける (#168)。
 *
 * ビュー JSON は `import` するとページに**丸ごとインライン展開される**ため、
 * 1 本にまとめると使わない系列まで運ぶことになる。実測で `market-daily.json` は
 * 943 KB あり、`/economy` は 2 系列 (206 KB 相当)、`/japan` も 2 系列 (211 KB 相当) しか
 * 使っていないのに全部を抱えていた。
 *
 * **系列は 1 つのページからしか使わない。** 重複させると、片方だけ直して
 * 食い違う事故が起きる。`daily-series.test.ts` で重複が無いことを固定している。
 */
import type { MacroPoint } from './types';

/** 日次ビューに載せられる系列。`MacroPoint` のキーに限る。 */
export type DailyKey = Extract<
  keyof MacroPoint,
  | 'nikkei225'
  | 'vix'
  | 'usdjpy'
  | 'wti'
  | 'dollarIndex'
  | 'gold'
  | 'nominalRate'
  | 'breakeven'
  | 'realRate'
  | 'fedFundsRate'
  | 'termSpread'
  | 'hySpread'
  | 'igSpread'
  | 'newJobPostings'
  | 'twoYearRate'
  | 'sofr'
  | 'breakeven5y'
  | 'breakeven5y5y'
>;

/**
 * ページごとに必要な系列。**ここが唯一の定義**で、ビュー生成も読み込みもここを見る。
 *
 * 系列を足すときは、それを使うページの配列にだけ入れる。
 */
export const DAILY_SERIES = {
  market: [
    'vix',
    'dollarIndex',
    'gold',
    'nominalRate',
    'breakeven',
    'realRate',
    'fedFundsRate',
    'termSpread',
    'hySpread',
    'igSpread',
    'twoYearRate',
    'sofr',
    'breakeven5y',
    'breakeven5y5y',
  ],
  economy: ['wti', 'newJobPostings'],
  japan: ['nikkei225', 'usdjpy'],
} as const satisfies Record<string, readonly DailyKey[]>;

export type DailyViewName = keyof typeof DAILY_SERIES;

/** 書き出すビューの一覧。`Object.keys` は型が緩くなるため明示する。 */
export const DAILY_VIEWS = Object.keys(DAILY_SERIES) as DailyViewName[];

/** 日次ビューの 1 点。載っていない系列は持たない。 */
export type DailyPoint = Partial<Pick<MacroPoint, DailyKey>> & { date: string };
