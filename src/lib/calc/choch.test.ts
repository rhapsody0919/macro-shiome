import { describe, expect, it } from 'vitest';
import { detectChoch } from './choch';
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

/**
 * 波形 (安値の谷・高値の山) を折れ線 (waypoint 間の線形補間) で組み立てる。
 * `high = low + 5` で固定しているため、`swingLength=3` で確実にスイングとして
 * 検出されるよう waypoint の間隔を空けてある (double-bottom.test.ts と同じ手法)。
 */
function wave(waypoints: Array<{ index: number; low: number }>): Array<{ date: string; low: number; high: number; close?: number }> {
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

// L1 (安値50, index6) → H1 (高値75, index13) → L2 (安値30, index20、L1より低い) →
// 回復 (index30まで、H1=75を上抜ける)
const TYPICAL_WAYPOINTS = [
  { index: 0, low: 65 },
  { index: 6, low: 50 }, // L1
  { index: 13, low: 70 }, // H1 (high = 75)
  { index: 20, low: 30 }, // L2 (L1 より低い)
  { index: 30, low: 78 }, // 回復。high=83、close はデフォルトで high と同じ
];

describe('detectChoch (#268)', () => {
  it('下落構造 (L1→H1→L2) の後、終値がH1を上抜けたら検出する', () => {
    const result = detectChoch(bars(wave(TYPICAL_WAYPOINTS)), 3);
    expect(result).not.toBeNull();
    expect(result!.firstLowDate).toBe(d(6));
    expect(result!.firstLowPrice).toBe(50);
    expect(result!.priorHighDate).toBe(d(13));
    expect(result!.priorHighPrice).toBe(75);
    expect(result!.secondLowDate).toBe(d(20));
    expect(result!.secondLowPrice).toBe(30);
    expect(result!.swingLength).toBe(3);
    // H1(75) を終値が上回る最初の足を返す (回復途中の線形補間なので厳密な日付は計算値)。
    expect(result!.breakoutPrice).toBeGreaterThan(75);
  });

  it('2つ目の安値が1つ目以上 (下落継続でない) なら検出しない', () => {
    const notLower = TYPICAL_WAYPOINTS.map((w) => (w.index === 20 ? { ...w, low: 55 } : w));
    expect(detectChoch(bars(wave(notLower)), 3)).toBeNull();
  });

  it('前回の高値をまだ上抜けていなければ検出しない', () => {
    const noBreakout = TYPICAL_WAYPOINTS.map((w) => (w.index === 30 ? { ...w, low: 60 } : w));
    expect(detectChoch(bars(wave(noBreakout)), 3)).toBeNull();
  });

  it('スイングが3点未満 (下落構造が組めない) なら検出しない', () => {
    // L1→H1 のみで L2 が無い短いデータ。
    const short = wave(TYPICAL_WAYPOINTS.slice(0, 2));
    expect(detectChoch(bars(short), 3)).toBeNull();
  });

  it('swingLength を指定すればその本数でスイングを判定する', () => {
    const result = detectChoch(bars(wave(TYPICAL_WAYPOINTS)), 3);
    // 既定値 (50) では waypoint の間隔が足りずスイングが確定しない。
    expect(detectChoch(bars(wave(TYPICAL_WAYPOINTS)))).toBeNull();
    expect(result).not.toBeNull();
  });
});
