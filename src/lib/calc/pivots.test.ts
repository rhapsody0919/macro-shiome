import { describe, expect, it } from 'vitest';
import { averageBarWidth, findPivots } from './pivots';
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

function bars(entries: Array<{ date: string } & Parameters<typeof bar>[0]>): SortedBars {
  return entries.map(({ date, ...rest }) => ({ date, bar: bar(rest) }));
}

describe('findPivots (#256)', () => {
  it('前後 2 本の範囲で未突破の高値・安値をピボットとして検出する', () => {
    // インデックス 3 (day4) が高値 100 で前後 2 本の中の最大、
    // インデックス 6 (day7) が安値 40 で前後 2 本の中の最小。
    const data = bars([
      { date: '2026-01-01', low: 50, high: 60 },
      { date: '2026-01-02', low: 55, high: 65 },
      { date: '2026-01-03', low: 60, high: 90 },
      { date: '2026-01-04', low: 65, high: 100 }, // ピボット高値
      { date: '2026-01-05', low: 60, high: 85 },
      { date: '2026-01-06', low: 55, high: 70 },
      { date: '2026-01-07', low: 40, high: 60 }, // ピボット安値
      { date: '2026-01-08', low: 45, high: 65 },
      { date: '2026-01-09', low: 50, high: 70 },
    ]);
    const pivots = findPivots(data, 2, 2);
    const highPivots = pivots.filter((p) => p.type === 'high');
    const lowPivots = pivots.filter((p) => p.type === 'low');
    expect(highPivots).toEqual([{ index: 3, date: '2026-01-04', price: 100, type: 'high' }]);
    expect(lowPivots).toEqual([{ index: 6, date: '2026-01-07', price: 40, type: 'low' }]);
  });

  it('同値が並ぶと未突破にならずピボットにならない', () => {
    const data = bars([
      { date: '2026-01-01', low: 50, high: 60 },
      { date: '2026-01-02', low: 50, high: 70 },
      { date: '2026-01-03', low: 50, high: 70 }, // 隣と同値 → 未突破ではない
      { date: '2026-01-04', low: 50, high: 60 },
      { date: '2026-01-05', low: 50, high: 60 },
    ]);
    const pivots = findPivots(data, 1, 1);
    expect(pivots.filter((p) => p.type === 'high')).toEqual([]);
  });

  it('配列の両端 (barsLeft/barsRight 本に満たない範囲) は判定しない', () => {
    const data = bars([
      { date: '2026-01-01', low: 10, high: 200 }, // 突出した高値だが端なので対象外
      { date: '2026-01-02', low: 50, high: 60 },
      { date: '2026-01-03', low: 50, high: 60 },
    ]);
    const pivots = findPivots(data, 1, 1);
    expect(pivots).toEqual([]);
  });

  it('観測が範囲に満たなければ空配列を返す', () => {
    const data = bars([{ date: '2026-01-01', low: 50, high: 60 }]);
    expect(findPivots(data, 6, 6)).toEqual([]);
    expect(findPivots([], 6, 6)).toEqual([]);
  });
});

describe('averageBarWidth (#256)', () => {
  it('高値-安値の平均を返す', () => {
    const data = bars([
      { date: '2026-01-01', low: 10, high: 20 }, // 幅 10
      { date: '2026-01-02', low: 10, high: 30 }, // 幅 20
    ]);
    expect(averageBarWidth(data)).toBeCloseTo(15, 5);
  });

  it('観測が無ければ 0 を返す', () => {
    expect(averageBarWidth([])).toBe(0);
  });
});
