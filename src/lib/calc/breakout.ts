/**
 * N 日高値抜け (Donchian チャネル/タートルズ型) のブレイクアウト検出 (#264)。
 *
 * カップウィズハンドル (#230)・ダブルボトム (#256)・逆三尊 (#258)・
 * High Tight Flag (#231) を置き換える。詳細な経緯は `BreakoutDetection` (types.ts)
 * のコメントを参照。
 *
 * 定義: 直近 `lookbackDays` 営業日の高値 (基準日を含まない) を、基準日の終値が
 * 上回っていること。タートルズの短期システム (System 1, N=20) に準拠する。
 */
import type { BreakoutDetection } from '../data/types';
import type { SortedBars } from './bars';

/** 判定に使う既定の営業日数。タートルズの短期システム (System 1) に準拠。 */
export const DEFAULT_LOOKBACK_DAYS = 20;

/**
 * `bars` (日付昇順) の中から、基準日 (`bars` の末尾) がブレイクアウトしているかを判定する。
 *
 * 直近 `lookbackDays` 本 (基準日を除く) の最高値を、基準日の終値が上回っていれば検出する。
 * 判定に十分な本数が無ければ `null`。
 */
export function detectBreakout(
  bars: SortedBars,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): BreakoutDetection | null {
  if (bars.length < lookbackDays + 1) return null;

  const asOf = bars[bars.length - 1];
  const window = bars.slice(bars.length - 1 - lookbackDays, bars.length - 1);

  let priorHigh = window[0];
  for (const bar of window) {
    if (bar.bar.high > priorHigh.bar.high) priorHigh = bar;
  }

  if (asOf.bar.close <= priorHigh.bar.high) return null;

  return {
    breakoutDate: asOf.date,
    breakoutPrice: asOf.bar.close,
    priorHighDate: priorHigh.date,
    priorHighPrice: priorHigh.bar.high,
    lookbackDays,
  };
}
