/**
 * CHoCH (Change of Character) の検出 (#268)。
 *
 * Smart Money Concepts (SMC/ICT) の概念。下落トレンド (安値切り下げ) の途中で、
 * 終値が直近の戻り高値 (下落トレンド中の「前回の高値」) を上抜けたことを検出する。
 * トレンド転換 (下落 → 上昇) の兆候として扱われる。
 *
 * オープンソースの Smart Money Concepts 実装
 * (`joshyattridge/smart-money-concepts`, GitHub, MIT ライセンス) の `bos_choch()` を
 * 参考にした。**BOS (Break of Structure、トレンド継続) は対象外**、強気 CHoCH のみを
 * 実装する (#264 の N 日高値抜けをこちらに置き換える際の要望に基づく)。
 *
 * 一次情報の実装はスイング点全体をバッチで解析し「2 番目の安値がスイングとして
 * 確定した時点」で判定するが、日次バッチ (未来のデータを持たない) では
 * `findSwings` (#268) の前後判定の性質上、2 番目の安値がスイングとして確定するのに
 * その後 `swingLength` 本の観測が要る。**上抜けの確認自体はスイング確定を待たず、
 * 2 番目の安値の直後から基準日まで全バーを対象に行う** — 「前回の高値を超えたか」は
 * 終値の水準比較だけで判定でき、上抜けた足がスイングになるのを待つ理由が無いため。
 */
import type { BreakoutDetection } from '../data/types';
import type { SortedBars } from './bars';
import { findSwings } from './swing';

/** スイング判定に使う既定の前後本数。一次情報のデフォルト値 (50) を出発点にする。 */
export const DEFAULT_SWING_LENGTH = 50;

/**
 * `bars` (日付昇順) の中から、直近の下落構造 (安値 → 戻り高値 → より低い安値) の後、
 * 終値がその戻り高値を上抜けた最初の足を検出する。
 *
 * 直近のスイング安値から遡って [1つ目の安値 (L1) → 戻り高値 (H1) → 2つ目の安値 (L2)]
 * の3点を取り、L2 が L1 より低い (下落継続) ことを確認したうえで、L2 以降で終値が
 * H1 を上回った最初の足を上抜けとして返す。上抜けが無ければ `null`。
 */
export function detectChoch(
  bars: SortedBars,
  swingLength = DEFAULT_SWING_LENGTH,
): BreakoutDetection | null {
  const swings = findSwings(bars, swingLength);

  let secondLowSwingIndex = -1;
  for (let i = swings.length - 1; i >= 0; i--) {
    if (swings[i]!.type === 'low') {
      secondLowSwingIndex = i;
      break;
    }
  }
  if (secondLowSwingIndex < 2) return null;

  const secondLow = swings[secondLowSwingIndex]!;
  const priorHigh = swings[secondLowSwingIndex - 1]!;
  const firstLow = swings[secondLowSwingIndex - 2]!;

  // 安値切り下げ (下落継続) になっていることを確認する。
  if (secondLow.price >= firstLow.price) return null;

  for (let i = secondLow.index + 1; i < bars.length; i++) {
    if (bars[i]!.bar.close > priorHigh.price) {
      return {
        firstLowDate: firstLow.date,
        firstLowPrice: firstLow.price,
        priorHighDate: priorHigh.date,
        priorHighPrice: priorHigh.price,
        secondLowDate: secondLow.date,
        secondLowPrice: secondLow.price,
        breakoutDate: bars[i]!.date,
        breakoutPrice: bars[i]!.bar.close,
        swingLength,
      };
    }
  }

  return null;
}
