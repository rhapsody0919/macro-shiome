/**
 * 市場構造のブレイク検出の共有ロジック (#268 #272)。
 *
 * Smart Money Concepts (SMC/ICT) の BOS (Break of Structure) と CHoCH
 * (Change of Character) は、どちらも同じ 3 点構造 [1つ目の安値 (L1) → 戻り高値 (H1) →
 * 2つ目の安値 (L2)] から、終値が H1 を上抜けたかどうかを見る点で共通する
 * (`joshyattridge/smart-money-concepts`, GitHub, MIT ライセンス, `bos_choch()` を参考)。
 * 違いは L2 が L1 より高いか低いかだけ (トレンド継続か転換か)。
 *
 * この共有部分 (構造の抽出とブレイクの検出) をここに切り出し、`choch.ts`/`bos.ts` は
 * トレンド方向の判定だけを行う。
 */
import type { OhlcvBar } from '../data/types';
import type { SortedBars } from './bars';
import { findSwings } from './swing';

/** スイング判定に使う既定の前後本数。一次情報のデフォルト値 (50) を出発点にする。 */
export const DEFAULT_SWING_LENGTH = 50;

export interface StructureBreak {
  /** 1 つ目の安値 (下落構造の起点)。 */
  firstLowDate: string;
  firstLowPrice: number;
  /** 戻り高値。これを終値が上抜けたことを検出する。 */
  priorHighDate: string;
  priorHighPrice: number;
  /** 2 つ目の安値。 */
  secondLowDate: string;
  secondLowPrice: number;
  /** 戻り高値を終値が上抜けた日。 */
  breakoutDate: string;
  breakoutPrice: number;
  /** スイング判定に使った前後本数。 */
  swingLength: number;
}

/**
 * `bars` (日付昇順) の中から、直近の [1つ目の安値 (L1) → 戻り高値 (H1) → 2つ目の安値 (L2)]
 * の3点構造の後、終値が H1 を上抜けた最初の足を検出する。
 *
 * **トレンドの向き (L2 が L1 より高いか低いか) は判定しない** — それは呼び出し側
 * (`choch.ts`/`bos.ts`) の責務。
 *
 * 一次情報の実装はスイング点全体をバッチで解析し「2 番目の安値がスイングとして
 * 確定した時点」で判定するが、日次バッチ (未来のデータを持たない) では
 * `findSwings` の前後判定の性質上、2 番目の安値がスイングとして確定するのに
 * その後 `swingLength` 本の観測が要る。**上抜けの確認自体はスイング確定を待たず、
 * 2 番目の安値の直後から基準日まで全バーを対象に行う** — 「戻り高値を超えたか」は
 * 終値の水準比較だけで判定でき、上抜けた足がスイングになるのを待つ理由が無いため。
 */
export function findStructureBreak(
  bars: SortedBars,
  swingLength: number,
): StructureBreak | null {
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

  for (let i = secondLow.index + 1; i < bars.length; i++) {
    const bar: OhlcvBar = bars[i]!.bar;
    if (bar.close > priorHigh.price) {
      return {
        firstLowDate: firstLow.date,
        firstLowPrice: firstLow.price,
        priorHighDate: priorHigh.date,
        priorHighPrice: priorHigh.price,
        secondLowDate: secondLow.date,
        secondLowPrice: secondLow.price,
        breakoutDate: bars[i]!.date,
        breakoutPrice: bar.close,
        swingLength,
      };
    }
  }

  return null;
}
