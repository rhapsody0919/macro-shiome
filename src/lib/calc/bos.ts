/**
 * BOS (Break of Structure) の検出 (#272)。
 *
 * Smart Money Concepts (SMC/ICT) の概念。上昇トレンド (安値切り上げ) の途中で、
 * 終値が直近の戻り高値を上抜けたことを検出する。CHoCH (#268) がトレンド**転換**
 * (下落 → 上昇) の兆候であるのに対し、BOS は既に上昇トレンドが**継続**している
 * ことの確認シグナルとして扱われる。
 *
 * 構造の抽出とブレイクの検出は `structure-break.ts` (CHoCH と共有) に切り出してある。
 * ここでは「2 つ目の安値が 1 つ目より高い (上昇継続)」というトレンド方向の判定だけを行う。
 */
import type { BosDetection } from '../data/types';
import type { SortedBars } from './bars';
import { findStructureBreak, DEFAULT_SWING_LENGTH } from './structure-break';

export { DEFAULT_SWING_LENGTH };

/**
 * `bars` (日付昇順) の中から、直近の上昇構造 (安値 → 戻り高値 → より高い安値) の後、
 * 終値がその戻り高値を上抜けた最初の足を検出する。上抜けが無い、または安値が
 * 切り上がっていなければ `null`。
 */
export function detectBos(
  bars: SortedBars,
  swingLength = DEFAULT_SWING_LENGTH,
): BosDetection | null {
  const structure = findStructureBreak(bars, swingLength);
  if (structure === null) return null;
  // 安値切り上げ (上昇継続) になっていなければ BOS ではない。
  if (structure.secondLowPrice <= structure.firstLowPrice) return null;
  return structure;
}
