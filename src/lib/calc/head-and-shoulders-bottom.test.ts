import { describe, expect, it } from 'vitest';
import { detectHeadAndShouldersBottom } from './head-and-shoulders-bottom';
import type { SortedBars } from './high-tight-flag';
import type { OhlcvBar } from '../data/types';

function bar(partial: Partial<OhlcvBar> & { high: number; low: number }): OhlcvBar {
  return {
    open: partial.open ?? partial.low,
    high: partial.high,
    low: partial.low,
    close: partial.close ?? partial.high,
    volume: partial.volume ?? 1000,
  };
}

type BarSpec = { date: string } & Parameters<typeof bar>[0];

function bars(entries: BarSpec[]): SortedBars {
  return entries.map(({ date, ...rest }) => ({ date, bar: bar(rest) }));
}

function d(offset: number): string {
  const date = new Date('2026-01-01T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * 波形 (安値の谷・高値の山) を折れ線 (waypoint 間の線形補間) で組み立てる。
 * `high = low + 5` で固定しているため、平均バー幅 (`averageBarWidth`) は常に 5 になり、
 * 閾値の計算 (平均バー幅 × 比率) を暗算しやすくする。waypoint 自身は区間の折り返し点
 * になるため、`findPivots` の既定 (前後6本) を満たす間隔さえ空けておけば、狙った
 * index が確実にピボットとして検出される。
 */
function wave(waypoints: Array<{ index: number; low: number }>): BarSpec[] {
  const lows = new Map<number, number>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const steps = end.index - start.index;
    for (let s = 0; s <= steps; s++) {
      const idx = start.index + s;
      if (lows.has(idx)) continue; // 区間の境界 (waypoint) は 1 度だけ設定する
      lows.set(idx, start.low + ((end.low - start.low) * s) / steps);
    }
  }
  const maxIndex = Math.max(...waypoints.map((w) => w.index));
  const entries: BarSpec[] = [];
  for (let idx = 0; idx <= maxIndex; idx++) {
    const low = lows.get(idx);
    if (low === undefined) throw new Error(`waypoint の間隔が不正: index ${idx} が埋まらない`);
    entries.push({ date: d(idx), low, high: low + 5 });
  }
  return entries;
}

// 典型的なヘッド・アンド・ショルダーズ・ボトム:
// A(左肩,50,index6) → B(左ネックライン,95,index13) → C(頭,20,index20) →
// D(右ネックライン,95,index27) → E(右肩,48,index34) → 回復 (index40 まで、まだネックライン未到達)
const TYPICAL_WAYPOINTS = [
  { index: 0, low: 68 },
  { index: 6, low: 50 }, // A: 左肩
  { index: 13, low: 90 }, // B: 左ネックライン点 (high = 95)
  { index: 20, low: 20 }, // C: 頭
  { index: 27, low: 90 }, // D: 右ネックライン点 (high = 95)
  { index: 34, low: 48 }, // E: 右肩
  { index: 40, low: 72 }, // 回復の終端 (基準日、close = 77 < ネックライン 95)
];

describe('detectHeadAndShouldersBottom (#258)', () => {
  it('典型的なヘッド・アンド・ショルダーズ・ボトムを検出する', () => {
    const result = detectHeadAndShouldersBottom(bars(wave(TYPICAL_WAYPOINTS)));
    expect(result).not.toBeNull();
    expect(result!.leftShoulderDate).toBe(d(6));
    expect(result!.leftShoulderPrice).toBe(50);
    expect(result!.leftNecklineDate).toBe(d(13));
    expect(result!.leftNecklinePrice).toBe(95);
    expect(result!.headDate).toBe(d(20));
    expect(result!.headPrice).toBe(20);
    expect(result!.rightNecklineDate).toBe(d(27));
    expect(result!.rightNecklinePrice).toBe(95);
    expect(result!.rightShoulderDate).toBe(d(34));
    expect(result!.rightShoulderPrice).toBe(48);
    expect(result!.necklinePrice).toBe(95);
    expect(result!.necklineDiffRatio).toBe(0);
    expect(result!.shoulderDepthRatio).toBeCloseTo(28 / 5);
  });

  it('観測が少なすぎればピボットが検出できず null を返す', () => {
    expect(detectHeadAndShouldersBottom(bars(wave(TYPICAL_WAYPOINTS)).slice(0, 10))).toBeNull();
  });

  it('頭と右肩の差が平均バー幅の0.6倍以下なら検出しない (頭が浅すぎる)', () => {
    // C を 20 → 46 に引き上げる。46 < min(A=50, E=48) は満たすが、
    // |46 - 48| = 2 <= avgWidth(5) * 0.6 = 3 で深さ条件だけが失敗する。
    const shallowHead = TYPICAL_WAYPOINTS.map((w) => (w.index === 20 ? { ...w, low: 46 } : w));
    expect(detectHeadAndShouldersBottom(bars(wave(shallowHead)))).toBeNull();
  });

  it('左右のネックライン点の差が平均バー幅以上なら検出しない (ネックラインが水平でない)', () => {
    // D を 90 → 100 に引き上げる。|95 - 105| = 10 >= avgWidth(5) * 1.0 = 5 で
    // 水平性の条件だけが失敗する (他の条件はすべて満たす)。
    const slopedNeckline = TYPICAL_WAYPOINTS.map((w) =>
      w.index === 27 ? { ...w, low: 100 } : w,
    );
    expect(detectHeadAndShouldersBottom(bars(wave(slopedNeckline)))).toBeNull();
  });

  it('右肩の形成後に一度でも終値がネックラインを超えていたら検出しない (既にブレイクアウト済み)', () => {
    // index37 (E=index34 より後、基準日 index40 より前) の終値だけをネックライン
    // (95) 超えにする。low/high は変えないため A〜E のピボット判定には影響しない。
    // 基準日 (index40) の終値自体は範囲内 (77) に戻っているが、経路の途中で
    // 上抜けている以上パターンは既に解決済みとみなし、検出してはいけない。
    const brokenOut = wave(TYPICAL_WAYPOINTS).map((entry) =>
      entry.date === d(37) ? { ...entry, close: 100 } : entry,
    );
    expect(detectHeadAndShouldersBottom(bars(brokenOut))).toBeNull();
  });

  it('右肩の形成後に一度でも右肩の安値を割っていたら検出しない (下抜け済み)', () => {
    // index36 の終値だけを右肩 (48) 未満にする。low/high は変えないため
    // 右肩ピボット自体の判定には影響しない。基準日の終値は範囲内に戻っているが、
    // 経路の途中で右肩を割っている以上「反発の途中」ではないため検出してはいけない。
    const undercut = wave(TYPICAL_WAYPOINTS).map((entry) =>
      entry.date === d(36) ? { ...entry, close: 40 } : entry,
    );
    expect(detectHeadAndShouldersBottom(bars(undercut))).toBeNull();
  });
});
