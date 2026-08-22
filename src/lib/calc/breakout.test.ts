import { describe, expect, it } from 'vitest';
import { detectBreakout } from './breakout';
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

// 直近20営業日の高値は index10 (high=60)。基準日 (index20) の終値が 61 でこれを上抜ける。
function windowEntries(): Array<{ date: string } & Parameters<typeof bar>[0]> {
  const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
  for (let i = 0; i <= 19; i++) {
    entries.push({ date: d(i), low: 40, high: i === 10 ? 60 : 50 });
  }
  entries.push({ date: d(20), low: 55, high: 61, close: 61 }); // 基準日
  return entries;
}

describe('detectBreakout (#264)', () => {
  it('直近20営業日の高値を終値が上抜けたら検出する', () => {
    const result = detectBreakout(bars(windowEntries()));
    expect(result).not.toBeNull();
    expect(result!.breakoutDate).toBe(d(20));
    expect(result!.breakoutPrice).toBe(61);
    expect(result!.priorHighDate).toBe(d(10));
    expect(result!.priorHighPrice).toBe(60);
    expect(result!.lookbackDays).toBe(20);
  });

  it('終値が直近高値以下なら検出しない', () => {
    const entries = windowEntries().map((e) => (e.date === d(20) ? { ...e, close: 60 } : e));
    expect(detectBreakout(bars(entries))).toBeNull();
  });

  it('観測本数が lookbackDays + 1 未満なら検出しない', () => {
    expect(detectBreakout(bars(windowEntries()).slice(0, 15))).toBeNull();
  });

  it('lookbackDays を指定すればその本数で判定する', () => {
    // 直近5営業日 (index16〜20) の高値は index20 自身を除くと 50。終値 61 はこれを上抜ける。
    const result = detectBreakout(bars(windowEntries()), 5);
    expect(result).not.toBeNull();
    expect(result!.priorHighPrice).toBe(50);
    expect(result!.lookbackDays).toBe(5);
  });

  it('基準日自身の高値はウィンドウに含めない', () => {
    // 基準日 (index20) の high を極端に高くしても、判定対象は基準日を除く直近20本のまま。
    const entries = windowEntries().map((e) => (e.date === d(20) ? { ...e, high: 999 } : e));
    const result = detectBreakout(bars(entries));
    expect(result!.priorHighPrice).toBe(60); // 999 ではなく index10 の 60 のまま
  });
});
