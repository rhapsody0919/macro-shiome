/**
 * スイングハイ・ロー (局所的な高値・安値) の検出 (#268)。
 *
 * オープンソースの Smart Money Concepts 実装
 * (`joshyattridge/smart-money-concepts`, GitHub, MIT ライセンス, 1,949 stars) の
 * `swing_highs_lows()` を参考にした。MIT のため #256 (`pivots.ts`、GPLv3 の `stock-pattern`
 * を参考にした際はアイデアのみ) より踏み込んでアルゴリズムを参考にできるが、
 * pandas/numpy のベクトル化実装をそのまま移植すると可読性が落ちるため、
 * 同じ結果になるループ実装に書き直している (コードとしては移植していない)。
 *
 * 手順は 2 段階。
 *
 * 1. 前後 `swingLength` 本の中で未突破の高値/安値を候補として抽出する
 *    (#256 の `pivots.ts` と同じ発想)
 * 2. **高値→安値→高値→安値と厳密に交互になるよう後処理する。** 同じ向きの候補が
 *    連続したら、より極端な方 (高値ならより高い方、安値ならより低い方) だけを残す
 *    (同値なら先着を残す)。`pivots.ts` には無かった処理で、CHoCH (#268) の判定が
 *    「直近 3 点の水準の並び」を前提にするため、交互構造が保証されている必要がある。
 *
 * **一次情報の境界処理は移植していない。** 元実装は配列の絶対先頭・末尾を無条件で
 * スイング点に強制変換するが、これは「対象データの端」という恣意的な境界に依存し
 * 根拠が薄いため (#52 の原則)、この処理は行わない。
 */
import type { SortedBars } from './bars';

export interface Swing {
  index: number;
  date: string;
  price: number;
  type: 'high' | 'low';
}

/**
 * `bars` (日付昇順) からスイング高値・安値を抽出する。
 *
 * `bars[i]` がスイング高値であるとは、前後 `swingLength` 本の範囲内で `bars[i].bar.high`
 * が最大 (同値を含めて他に並ぶ点が無い) であること。スイング安値も同様に最小値で判定する。
 * **配列の両端 (`swingLength` 本に満たない範囲) は判定対象外** — 直近 `swingLength` 本は
 * 前後判定に必要な「後」のデータが無いため、確定できない。
 */
export function findSwings(bars: SortedBars, swingLength: number): Swing[] {
  const candidates: Swing[] = [];
  for (let i = swingLength; i < bars.length - swingLength; i++) {
    const high = bars[i].bar.high;
    const low = bars[i].bar.low;
    let isHigh = true;
    let isLow = true;

    for (let k = i - swingLength; k <= i + swingLength; k++) {
      if (k === i) continue;
      if (bars[k].bar.high >= high) isHigh = false;
      if (bars[k].bar.low <= low) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) candidates.push({ index: i, date: bars[i].date, price: high, type: 'high' });
    else if (isLow) candidates.push({ index: i, date: bars[i].date, price: low, type: 'low' });
  }

  return enforceAlternation(candidates);
}

/**
 * 同じ向きのスイング候補が連続したら、より極端な方だけを残し高値→安値→高値→安値と
 * 厳密に交互になるようにする。同値なら先着 (時系列で先の点) を残す。
 */
function enforceAlternation(candidates: readonly Swing[]): Swing[] {
  const result: Swing[] = [];
  for (const candidate of candidates) {
    const last = result.at(-1);
    if (last === undefined || last.type !== candidate.type) {
      result.push(candidate);
      continue;
    }
    const replaceLast =
      candidate.type === 'high' ? candidate.price > last.price : candidate.price < last.price;
    if (replaceLast) result[result.length - 1] = candidate;
  }
  return result;
}
