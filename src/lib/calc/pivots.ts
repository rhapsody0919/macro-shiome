/**
 * 局所的な高値・安値 (ピボット) の検出 (#256)。
 *
 * カップウィズハンドル (#230, #251, #254) では「3点 (左リム・カップ底・右リム) だけを
 * 見て、後から条件を継ぎ足す」設計を繰り返し、そのたびに新しいエッジケースが見つかる
 * いたちごっこになった (放物線フィットで検証してようやく気付いた左リムのバグが典型)。
 *
 * オープンソースのパターン検出ツール `stock-pattern` (BennyThadikaran/stock-pattern,
 * GPLv3) の設計思想を参考に、構造を変える。**コードは移植していない** (GPLv3 は
 * 独占的ソフトウェアへの組み込みを禁じており、macro-shiome は明示ライセンス無しの
 * ためコピーレフトのリスクを避ける)。参考にしたのはアイデアのみ:
 *
 * - 前後 N 本の中で「未突破の高値/安値」だけを局所極値として抽出する。これにより
 *   「この点が本当に局所的な高値か」を後付けの条件チェックではなく、入力データの
 *   時点で構造的に保証する
 * - 2点が「ほぼ同じ水準」かどうかは、固定比率 (カップウィズハンドルで使った 0.95 の
 *   ような) ではなく、対象期間の平均バー幅を基準にした相対的な許容誤差で判定する
 */
import type { SortedBars } from './high-tight-flag';

export interface Pivot {
  index: number;
  date: string;
  price: number;
  type: 'high' | 'low';
}

const DEFAULT_BARS_LEFT = 6;
const DEFAULT_BARS_RIGHT = 6;

/**
 * `bars` (日付昇順) からピボット高値・安値を抽出する。
 *
 * `bars[i]` がピボット高値であるとは、前後 `barsLeft`/`barsRight` 本の範囲内で
 * `bars[i].bar.high` が最大 (同値を含めて他に並ぶ点が無い) であること。ピボット安値も
 * 同様に最小値で判定する。**配列の両端 (`barsLeft`/`barsRight` 本に満たない範囲) は
 * 判定対象外**。
 */
export function findPivots(
  bars: SortedBars,
  barsLeft = DEFAULT_BARS_LEFT,
  barsRight = DEFAULT_BARS_RIGHT,
): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = barsLeft; i < bars.length - barsRight; i++) {
    const high = bars[i].bar.high;
    const low = bars[i].bar.low;
    let isHighPivot = true;
    let isLowPivot = true;

    for (let k = i - barsLeft; k <= i + barsRight; k++) {
      if (k === i) continue;
      if (bars[k].bar.high >= high) isHighPivot = false;
      if (bars[k].bar.low <= low) isLowPivot = false;
      if (!isHighPivot && !isLowPivot) break;
    }

    if (isHighPivot) pivots.push({ index: i, date: bars[i].date, price: high, type: 'high' });
    if (isLowPivot) pivots.push({ index: i, date: bars[i].date, price: low, type: 'low' });
  }
  return pivots;
}

/**
 * 平均バー幅 (高値 − 安値の平均)。2点が「ほぼ同じ水準」かを判定する許容誤差の基準に使う。
 * 銘柄ごとの値動きの荒さに応じて許容誤差が自動的に変わる (固定比率にしない理由)。
 */
export function averageBarWidth(bars: SortedBars): number {
  if (bars.length === 0) return 0;
  const total = bars.reduce((sum, b) => sum + (b.bar.high - b.bar.low), 0);
  return total / bars.length;
}
