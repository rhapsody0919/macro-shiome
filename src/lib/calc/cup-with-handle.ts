/**
 * カップウィズハンドルのパターン検出 (#230)。
 *
 * William O'Neil による厳格な数値定義を採用する。複数の独立ソース (Fidelity,
 * StockCharts, TraderLion, Bulkowski) で条件が一致することを確認済み
 * (書籍・IBD 公式そのものには未到達、二次情報の一致による裏取り)。
 *
 * | 項目 | 条件 |
 * | --- | --- |
 * | 深さ | 直近上昇幅の 1/3 以下が理想、1/3〜1/2 まで許容、Dow 理論に基づき最大 2/3 |
 * | カップ期間 | 7〜65 週 |
 * | ハンドル期間 | 1〜4 週、カップの上半分で形成 |
 *
 * **「U 字型 (V 字は不可)」の形状条件は判定に含めない。** 一次情報 (Fidelity/StockCharts等)
 * は定性的にしか説明しておらず、定量化する明確な数値基準が見当たらなかった。恣意的な
 * パーセンテージの閾値を独自に作ると「恣意的な閾値を置かない」原則 (#52) に反するため、
 * 深さ・期間・ハンドル・右リムの回復率という数値化できる条件だけで判定する。
 *
 * **右リムが左リムの 95% 以上に回復していることを要求する。** これは一次情報の直接の
 * 数値ではなく、「カップが完成した (右リムが左リムに近い水準まで戻った)」ことを保証する
 * ための実装上の判断。この 1 点だけは恣意的な数値であることを明記する。
 *
 * **ハンドルの深さにも上限がある** (#251)。StockCharts (ChartSchool):
 * "The handle can retrace up to 1/3 of the cup's advance, but usually not more."
 * カップと同じ「直近上昇幅」を基準に、右リムからの下落率が 1/3 を超えたら除外する。
 *
 * **右リムはハンドル期間中の最高値であることを要求する** (#251)。当初の実装 (#230) は
 * 右リム候補の後に価格がさらに上昇していても無視しており、実質的には「まだ上昇トレンド
 * 継続中」の途中を「ハンドル」として誤検出していた。実データ (2 年分バックフィル後) で
 * 確認したところ、検出された 34/36 銘柄中 26 銘柄でこの条件が破れていた
 * (例: 右リム候補 91.02 のに対しハンドル期間の最高値が 103.25、13% も上振れ)。
 * この 2 条件を追加する前は `handleInUpperHalf` (カップ中間点以上か) だけで判定して
 * おり、右リムが左リムの 95% 以上まで回復している前提のもとではほぼ常に真になっていた。
 */
import { diffDays } from './weeks';
import type { CupWithHandleCup, CupWithHandleDetection } from '../data/types';
import type { SortedBars } from './high-tight-flag';

const CUP_MIN_WEEKS = 7;
const CUP_MAX_WEEKS = 65;
/** 深さの上限 (%)。Dow 理論に基づく最大許容値 (2/3)。 */
const CUP_MAX_DEPTH_PERCENT = (2 / 3) * 100;
const HANDLE_MIN_WEEKS = 1;
const HANDLE_MAX_WEEKS = 4;
/** 右リムが左リムのこの比率以上に回復していることを要求する (実装上の判断、上記コメント参照)。 */
const RIGHT_RIM_MIN_RECOVERY_RATIO = 0.95;
/** ハンドルの深さの上限 (%)。直近上昇幅の 1/3 (#251、StockCharts の定義)。 */
const HANDLE_MAX_DEPTH_PERCENT = (1 / 3) * 100;

function average(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * `rightRimIndex` を右リムとして、7〜65 週間前の範囲で最良のカップ (左リム・カップ底・
 * 上昇トレンドの起点) を探す。**最も右リムに近い (カップ期間が短い) 候補を優先する**、
 * 「直近で形成しているパターン」を検出するため。
 */
function findBestCup(bars: SortedBars, rightRimIndex: number): CupWithHandleCup | null {
  const rightRimBar = bars[rightRimIndex];
  let best: CupWithHandleCup | null = null;

  for (let leftRimIndex = rightRimIndex; leftRimIndex >= 0; leftRimIndex--) {
    const leftRimBar = bars[leftRimIndex];
    const cupWeeks = diffDays(leftRimBar.date, rightRimBar.date) / 7;
    if (cupWeeks > CUP_MAX_WEEKS) break; // これより左は必ず範囲外 (日付は昇順)
    if (cupWeeks < CUP_MIN_WEEKS) continue;

    // カップ底: 左リムから右リムまでの最安値。
    let cupBottomIndex = -1;
    let cupBottomPrice = Number.POSITIVE_INFINITY;
    for (let k = leftRimIndex; k <= rightRimIndex; k++) {
      if (bars[k].bar.low < cupBottomPrice) {
        cupBottomPrice = bars[k].bar.low;
        cupBottomIndex = k;
      }
    }
    if (cupBottomIndex === -1) continue;
    // カップ底が左リム・右リムと同じ日では「下落してから回復する」形が無く、
    // カップとして意味をなさない (退化ケース)。両端より内側にあることを要求する。
    if (cupBottomIndex === leftRimIndex || cupBottomIndex === rightRimIndex) continue;

    // 上昇トレンドの起点: 左リムから遡って CUP_MAX_WEEKS 以内の最安値。
    // 「直近上昇幅」を測るための基準 (#230 のコメント参照)。
    let advanceStartIndex = -1;
    let advanceStartPrice = Number.POSITIVE_INFINITY;
    for (let k = leftRimIndex; k >= 0; k--) {
      if (diffDays(bars[k].date, leftRimBar.date) > CUP_MAX_WEEKS * 7) break;
      if (bars[k].bar.low < advanceStartPrice) {
        advanceStartPrice = bars[k].bar.low;
        advanceStartIndex = k;
      }
    }
    if (advanceStartIndex === -1) continue;

    const previousAdvance = leftRimBar.bar.high - advanceStartPrice;
    if (previousAdvance <= 0) continue; // 上昇が無ければカップの前提が無い

    const depthPercent = ((leftRimBar.bar.high - cupBottomPrice) / previousAdvance) * 100;
    if (depthPercent > CUP_MAX_DEPTH_PERCENT) continue;

    const candidate: CupWithHandleCup = {
      advanceStartDate: bars[advanceStartIndex].date,
      advanceStartPrice,
      leftRimDate: leftRimBar.date,
      leftRimPrice: leftRimBar.bar.high,
      cupBottomDate: bars[cupBottomIndex].date,
      cupBottomPrice,
      rightRimDate: rightRimBar.date,
      rightRimPrice: rightRimBar.bar.high,
      depthPercent,
      weeks: cupWeeks,
    };

    // **最も長い (= 最も左に離れた、大きな) カップを優先する。**
    // 短い候補を優先すると、大きなカップの途中にある中間安値が「別の小さなカップの
    // 左リム」として誤って選ばれることがある (実測: #230 のテストで発覚)。
    // 直近性は呼び出し元 (右リム候補のループ) で担保しているため、ここでは
    // 「最も明確な (大きな) カップ」を選ぶ役割に徹する。
    if (best === null || candidate.weeks > best.weeks) {
      best = candidate;
    }
  }

  return best;
}

/**
 * `bars` (日付昇順) の中から、直近で形成中のカップウィズハンドルを検出する。
 *
 * **基準日は `bars` の最終日 (最新観測日)。** High Tight Flag (#231) と同じ設計で、
 * ハンドル期間 (右リムから 1〜4 週間) の終端が基準日に一致する候補から探索する。
 */
export function detectCupWithHandle(bars: SortedBars): CupWithHandleDetection | null {
  if (bars.length < 2) return null;
  const asOf = bars[bars.length - 1];

  for (let rightRimIndex = bars.length - 1; rightRimIndex >= 0; rightRimIndex--) {
    const rightRimBar = bars[rightRimIndex];
    const handleWeeks = diffDays(rightRimBar.date, asOf.date) / 7;
    if (handleWeeks > HANDLE_MAX_WEEKS) break; // これより左は必ず範囲外
    if (handleWeeks < HANDLE_MIN_WEEKS) continue;

    const handleBars = bars.slice(rightRimIndex + 1);
    if (handleBars.length === 0) continue;

    // 右リムがハンドル期間中の最高値であることを要求する (#251)。
    // そうでなければ、価格は右リム候補の後もさらに上昇を続けていることになり、
    // 「カップ完成後の押し目 (ハンドル)」ではなく単なる上昇トレンドの途中を
    // 切り取っているだけになる。実データ (2 年分バックフィル後) で確認したところ、
    // 検出された 34/36 銘柄中 26 銘柄がこの条件を満たしていなかった。
    const handleMaxHigh = Math.max(...handleBars.map((b) => b.bar.high));
    if (handleMaxHigh > rightRimBar.bar.high) continue;

    const cup = findBestCup(bars, rightRimIndex);
    if (cup === null) continue;

    if (rightRimBar.bar.high < cup.leftRimPrice * RIGHT_RIM_MIN_RECOVERY_RATIO) continue;

    const handleLow = Math.min(...handleBars.map((b) => b.bar.low));
    const cupMidpoint = (cup.leftRimPrice + cup.cupBottomPrice) / 2;
    const handleInUpperHalf = handleLow >= cupMidpoint;
    if (!handleInUpperHalf) continue;

    // ハンドルの深さ = 右リムからの下落 ÷ 直近上昇幅 (#251)。カップと同じ基準で測る。
    const previousAdvance = cup.leftRimPrice - cup.advanceStartPrice;
    const handleDepthPercent = ((rightRimBar.bar.high - handleLow) / previousAdvance) * 100;
    if (handleDepthPercent > HANDLE_MAX_DEPTH_PERCENT) continue;

    const cupBottomIndex = bars.findIndex((b) => b.date === cup.cupBottomDate);
    const leftHalfBars = bars.slice(
      bars.findIndex((b) => b.date === cup.leftRimDate),
      cupBottomIndex + 1,
    );
    const rightHalfBars = bars.slice(cupBottomIndex, rightRimIndex + 1);

    return {
      cup,
      handleStart: handleBars[0].date,
      handleEnd: asOf.date,
      handleWeeks,
      handleDepthPercent,
      handleInUpperHalf,
      volumeDecreasedDuringCup:
        average(leftHalfBars.map((b) => b.bar.volume)) > average(rightHalfBars.map((b) => b.bar.volume)),
      handleVolumeLight:
        average(handleBars.map((b) => b.bar.volume)) <
        average(bars.slice(bars.findIndex((b) => b.date === cup.leftRimDate), rightRimIndex + 1).map((b) => b.bar.volume)),
    };
  }

  return null;
}
