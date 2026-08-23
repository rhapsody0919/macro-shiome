import { describe, expect, it } from 'vitest';
import { findStructureBreak } from './structure-break';
import type { SortedBars } from './bars';
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

function bars(entries: Array<{ date: string } & Parameters<typeof bar>[0]>): SortedBars {
  return entries.map(({ date, ...rest }) => ({ date, bar: bar(rest) }));
}

function d(offset: number): string {
  const date = new Date('2026-01-01T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function wave(
  waypoints: Array<{ index: number; low: number }>,
): Array<{ date: string; low: number; high: number }> {
  const lows = new Map<number, number>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]!;
    const end = waypoints[i + 1]!;
    const steps = end.index - start.index;
    for (let s = 0; s <= steps; s++) {
      const idx = start.index + s;
      if (lows.has(idx)) continue;
      lows.set(idx, start.low + ((end.low - start.low) * s) / steps);
    }
  }
  const maxIndex = Math.max(...waypoints.map((w) => w.index));
  const entries: Array<{ date: string; low: number; high: number }> = [];
  for (let idx = 0; idx <= maxIndex; idx++) {
    const low = lows.get(idx);
    if (low === undefined) throw new Error(`waypoint の間隔が不正: index ${idx} が埋まらない`);
    entries.push({ date: d(idx), low, high: low + 5 });
  }
  return entries;
}

// L1 (index6, 50) → H1 (index13, high=75) → L2 (index20) → 回復 (index30、H1を上抜ける)。
// L2 の水準は呼び出し側テストで変える (トレンド方向を問わない共有ロジックのため)。
function waypoints(secondLow: number) {
  return [
    { index: 0, low: 65 },
    { index: 6, low: 50 },
    { index: 13, low: 70 },
    { index: 20, low: secondLow },
    { index: 30, low: 78 },
  ];
}

describe('findStructureBreak (#268 #272)', () => {
  it('L1→H1→L2の後、終値がH1を上抜けたら検出する (L2がL1より低くても高くても)', () => {
    for (const secondLow of [30, 60]) {
      const result = findStructureBreak(bars(wave(waypoints(secondLow))), 3);
      expect(result).not.toBeNull();
      expect(result!.firstLowDate).toBe(d(6));
      expect(result!.firstLowPrice).toBe(50);
      expect(result!.priorHighDate).toBe(d(13));
      expect(result!.priorHighPrice).toBe(75);
      expect(result!.secondLowDate).toBe(d(20));
      expect(result!.swingLength).toBe(3);
      expect(result!.breakoutPrice).toBeGreaterThan(75);
    }
  });

  it('戻り高値をまだ上抜けていなければ検出しない', () => {
    const noBreakout = waypoints(30).map((w) => (w.index === 30 ? { ...w, low: 60 } : w));
    expect(findStructureBreak(bars(wave(noBreakout)), 3)).toBeNull();
  });

  it('スイングが3点未満 (構造が組めない) なら検出しない', () => {
    const short = wave(waypoints(30).slice(0, 2));
    expect(findStructureBreak(bars(short), 3)).toBeNull();
  });
});
