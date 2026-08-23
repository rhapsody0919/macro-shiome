import { describe, expect, it } from 'vitest';
import { findSwings } from './swing';
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

describe('findSwings (#268)', () => {
  it('前後swingLength本の中で未突破の高値・安値をスイングとして検出する', () => {
    // 山 (index10, high=60) と谷 (index20, low=20) を、前後3本ずつの緩やかな傾斜で挟む。
    const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
    for (let i = 0; i <= 30; i++) {
      let low = 40;
      let high = 50;
      if (i === 10) {
        low = 55;
        high = 60;
      } else if (i === 20) {
        low = 20;
        high = 25;
      }
      entries.push({ date: d(i), low, high });
    }
    const swings = findSwings(bars(entries), 3);
    const types = swings.map((s) => ({ date: s.date, type: s.type, price: s.price }));
    expect(types).toContainEqual({ date: d(10), type: 'high', price: 60 });
    expect(types).toContainEqual({ date: d(20), type: 'low', price: 20 });
  });

  it('配列の両端 (swingLength本に満たない範囲) は判定対象外', () => {
    const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
    for (let i = 0; i <= 10; i++) entries.push({ date: d(i), low: 40, high: 50 });
    // index0 に極端な高値を置いても、前方に3本無いため候補にならない。
    entries[0] = { date: d(0), low: 90, high: 100 };
    const swings = findSwings(bars(entries), 3);
    expect(swings.some((s) => s.date === d(0))).toBe(false);
  });

  it('同じ向きの候補が連続したら、より極端な方だけを残す', () => {
    // index10 (high=60) と index16 (high=70、より高い) が連続する高値候補。
    // 間隔6は swingLength=3 の前後判定を満たすには短すぎるため、個別に山を作る。
    const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
    for (let i = 0; i <= 30; i++) {
      let low = 40;
      let high = 50;
      if (i === 10) high = 60;
      if (i === 20) high = 70; // より高い2つ目の山
      entries.push({ date: d(i), low, high });
    }
    const swings = findSwings(bars(entries), 3);
    const highs = swings.filter((s) => s.type === 'high');
    // 交互制約により、連続する高値候補のうち低い方 (index10) は間引かれる。
    expect(highs).toHaveLength(1);
    expect(highs[0]!.date).toBe(d(20));
    expect(highs[0]!.price).toBe(70);
  });

  it('同値の連続候補は先着 (時系列で先の点) を残す', () => {
    const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
    for (let i = 0; i <= 30; i++) {
      let low = 20;
      if (i === 10) low = 10;
      if (i === 20) low = 10; // 同値の安値
      entries.push({ date: d(i), low, high: low + 30 });
    }
    const swings = findSwings(bars(entries), 3);
    const lows = swings.filter((s) => s.type === 'low');
    expect(lows).toHaveLength(1);
    expect(lows[0]!.date).toBe(d(10));
  });

  it('交互になるよう整形された結果 (高値・安値が連続しない)', () => {
    const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
    for (let i = 0; i <= 40; i++) {
      let low = 40;
      let high = 50;
      if (i === 6) high = 60; // 高値
      if (i === 14) low = 20; // 安値
      if (i === 22) high = 65; // 高値
      if (i === 30) low = 15; // 安値
      entries.push({ date: d(i), low, high });
    }
    const swings = findSwings(bars(entries), 3);
    for (let i = 1; i < swings.length; i++) {
      expect(swings[i]!.type).not.toBe(swings[i - 1]!.type);
    }
    expect(swings.map((s) => s.type)).toEqual(['high', 'low', 'high', 'low']);
  });
});
