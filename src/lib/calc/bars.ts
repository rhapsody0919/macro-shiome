/**
 * 日足 OHLCV バーの共通型 (#229、#264 で `high-tight-flag.ts` から切り出し)。
 *
 * パターン検出 (`breakout.ts` など) が共通で使う、観測 (Record) を日付昇順の配列に
 * 変換する処理をここに集約する。
 */
import type { OhlcvBar } from '../data/types';

/** 日付昇順にソート済みの日足バー。 */
export type SortedBars = ReadonlyArray<{ date: string; bar: OhlcvBar }>;

/** 観測 (Record) を日付昇順の配列に変換する。 */
export function toSortedBars(observations: Readonly<Record<string, OhlcvBar>>): SortedBars {
  return Object.entries(observations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bar]) => ({ date, bar }));
}
