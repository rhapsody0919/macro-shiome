/**
 * High Tight Flag (ブルフラッグ) のパターン検出 (#231)。
 *
 * William O'Neil による厳格な数値定義を採用する。一般的な「ブルフラッグ」は形状の
 * 自由度が高くチューニングが避けられないため、固定の数値条件を持つこちらを使う
 * (#230/#231 の相談時にユーザーと合意した方針)。複数の独立ソース (TraderLion,
 * Bulkowski, Morpheus Trading) で条件が一致することを確認済み
 * (書籍・IBD 公式そのものには未到達、二次情報の一致による裏取り)。
 *
 * | 項目 | 条件 |
 * | --- | --- |
 * | ポール (急騰) | 8 週間以内に 100% 以上の上昇 |
 * | フラッグ (保ち合い) | 3〜5 週間、ポール高値から 25% 以内の下落に留める |
 *
 * パラメータは一次情報の数値をそのままコードに残す (#52 と同じ「恣意的な閾値を
 * 置かない」原則。ここでは定義そのものが閾値の根拠になる)。
 */
import { diffDays } from './weeks';
import type { HighTightFlagDetection, OhlcvBar } from '../data/types';

/** ポールが 8 週間以内に収まるか (日数換算)。 */
const POLE_MAX_WEEKS = 8;
/** ポールの最小上昇率 (%)。安値 → 高値で 2 倍以上。 */
const POLE_MIN_GAIN_PERCENT = 100;
/** フラッグの最短期間 (週)。これ未満は「まだ形成中」として判定しない。 */
const FLAG_MIN_WEEKS = 3;
/** フラッグの最長期間 (週)。これを超えて保ち合いが続く場合は無効とみなす。 */
const FLAG_MAX_WEEKS = 5;
/** フラッグ中の最大下落率 (%)。ポール高値からこれを超えて下がったら無効。 */
const FLAG_MAX_PULLBACK_PERCENT = 25;

/** 日付昇順にソート済みの日足バー。 */
export type SortedBars = ReadonlyArray<{ date: string; bar: OhlcvBar }>;

/** 観測 (Record) を日付昇順の配列に変換する。 */
export function toSortedBars(observations: Readonly<Record<string, OhlcvBar>>): SortedBars {
  return Object.entries(observations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bar]) => ({ date, bar }));
}

function average(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * ポールの起点 (安値) を `poleEndIndex` から遡って `POLE_MAX_WEEKS` 以内で探す。
 * 複数の安値候補があれば最も低い値を採用する (上昇率を最大化する起点)。
 */
function findPoleStart(
  bars: SortedBars,
  poleEndIndex: number,
): { index: number; price: number } | null {
  const poleEndDate = bars[poleEndIndex].date;
  let best: { index: number; price: number } | null = null;
  for (let j = poleEndIndex; j >= 0; j--) {
    if (diffDays(bars[j].date, poleEndDate) > POLE_MAX_WEEKS * 7) break;
    if (best === null || bars[j].bar.low < best.price) {
      best = { index: j, price: bars[j].bar.low };
    }
  }
  return best;
}

/**
 * `bars` (日付昇順) の中から、直近で形成中の High Tight Flag を検出する。
 *
 * **基準日は `bars` の最終日 (最新観測日)。** 「いま形成しているパターン」を探すため、
 * フラッグ期間 (ポール高値から 3〜5 週間) の終端が基準日に一致する候補から探索する。
 * ポール高値の候補日を基準日から遠い方 (35 日前) から近い方へ走査し、最初に条件を
 * 満たした候補 (= 最もフラッグ期間が長く、基準日に最も近いポール高値) を採用する。
 *
 * 条件を満たす候補が無ければ `null` (検出なし)。
 */
export function detectHighTightFlag(bars: SortedBars): HighTightFlagDetection | null {
  if (bars.length < 2) return null;
  const asOf = bars[bars.length - 1];

  for (let poleEndIndex = 0; poleEndIndex < bars.length - 1; poleEndIndex++) {
    const poleEndBar = bars[poleEndIndex];
    const daysSincePoleEnd = diffDays(poleEndBar.date, asOf.date);

    // ポール高値の候補は「基準日から 3〜5 週間前」の範囲に限る。
    if (daysSincePoleEnd > FLAG_MAX_WEEKS * 7) continue;
    if (daysSincePoleEnd < FLAG_MIN_WEEKS * 7) break; // bars は日付昇順なので以降も全て範囲外

    const poleStart = findPoleStart(bars, poleEndIndex);
    if (poleStart === null) continue;

    const gainPercent = (poleEndBar.bar.high / poleStart.price - 1) * 100;
    if (gainPercent < POLE_MIN_GAIN_PERCENT) continue;

    const flagBars = bars.slice(poleEndIndex + 1);
    if (flagBars.length === 0) continue;

    const flagLow = Math.min(...flagBars.map((b) => b.bar.low));
    const flagLowPercent = (1 - flagLow / poleEndBar.bar.high) * 100;
    if (flagLowPercent > FLAG_MAX_PULLBACK_PERCENT) continue;

    const poleBars = bars.slice(poleStart.index, poleEndIndex + 1);
    const volumeDecreased =
      average(flagBars.map((b) => b.bar.volume)) < average(poleBars.map((b) => b.bar.volume));

    return {
      pole: {
        startDate: bars[poleStart.index].date,
        startPrice: poleStart.price,
        endDate: poleEndBar.date,
        endPrice: poleEndBar.bar.high,
        gainPercent,
        weeks: diffDays(bars[poleStart.index].date, poleEndBar.date) / 7,
      },
      flagStart: flagBars[0].date,
      flagEnd: asOf.date,
      flagWeeks: daysSincePoleEnd / 7,
      flagLowPercent,
      volumeDecreased,
    };
  }

  return null;
}
