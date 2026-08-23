/**
 * CHoCH (Change of Character) の検出 (#268)。
 *
 * Smart Money Concepts (SMC/ICT) の概念。下落トレンド (安値切り下げ) の途中で、
 * 終値が直近の戻り高値 (下落トレンド中の「前回の高値」) を上抜けたことを検出する。
 * トレンド転換 (下落 → 上昇) の兆候として扱われる。
 *
 * 構造の抽出とブレイクの検出は `structure-break.ts` (#272 で BOS と共有化) に
 * 切り出してある。ここでは「2 つ目の安値が 1 つ目より低い (下落継続)」という
 * トレンド方向の判定だけを行う。
 */
import type { BreakoutDetection } from '../data/types';
import type { SortedBars } from './bars';
import { findStructureBreak, DEFAULT_SWING_LENGTH } from './structure-break';

export { DEFAULT_SWING_LENGTH };

/**
 * `bars` (日付昇順) の中から、直近の下落構造 (安値 → 戻り高値 → より低い安値) の後、
 * 終値がその戻り高値を上抜けた最初の足を検出する。上抜けが無い、または安値が
 * 切り下がっていなければ `null`。
 */
export function detectChoch(
  bars: SortedBars,
  swingLength = DEFAULT_SWING_LENGTH,
): BreakoutDetection | null {
  const structure = findStructureBreak(bars, swingLength);
  if (structure === null) return null;
  // 安値切り下げ (下落継続) になっていなければ CHoCH ではない。
  if (structure.secondLowPrice >= structure.firstLowPrice) return null;
  return structure;
}
