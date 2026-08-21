import { describe, expect, it } from 'vitest';
import { detectHighTightFlag, toSortedBars, type SortedBars } from './high-tight-flag';
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

describe('detectHighTightFlag (#231)', () => {
  // ポール: 2026-01-05 (安値 50) → 2026-02-16 (高値 105、42日 = 6週、上昇率 110%)
  // フラッグ: 2026-02-16 → 2026-03-13 (25日 = 3.57週、最安値 85 = -19.05%)
  // どちらも O'Neil の定義 (8週以内に100%以上、3〜5週で25%以内の下落) を満たす。
  it('典型的な High Tight Flag を検出する', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52, volume: 2000 },
      { date: '2026-01-20', low: 60, high: 75, volume: 2200 },
      { date: '2026-02-16', low: 100, high: 105, volume: 2500 }, // ポール高値
      { date: '2026-02-20', low: 90, high: 95, volume: 800 },
      { date: '2026-03-02', low: 85, high: 92, volume: 700 }, // フラッグ最安値
      { date: '2026-03-13', low: 88, high: 91, volume: 750 }, // 基準日
    ]);

    const result = detectHighTightFlag(data);

    expect(result).not.toBeNull();
    expect(result!.pole.startDate).toBe('2026-01-05');
    expect(result!.pole.startPrice).toBe(50);
    expect(result!.pole.endDate).toBe('2026-02-16');
    expect(result!.pole.endPrice).toBe(105);
    expect(result!.pole.gainPercent).toBeCloseTo(110, 9);
    expect(result!.pole.weeks).toBeCloseTo(6, 9);
    expect(result!.flagStart).toBe('2026-02-20');
    expect(result!.flagEnd).toBe('2026-03-13');
    expect(result!.flagWeeks).toBeCloseTo(25 / 7, 5);
    expect(result!.flagLowPercent).toBeCloseTo((1 - 85 / 105) * 100, 5);
    // フラッグ期間 (800, 700, 750) の平均 < ポール期間 (2000, 2200, 2500) の平均。
    expect(result!.volumeDecreased).toBe(true);
  });

  it('ポールの上昇率が 100% 未満なら検出しない', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      { date: '2026-02-16', low: 78, high: 80 }, // 60% 上昇のみ
      { date: '2026-02-20', low: 72, high: 76 },
      { date: '2026-03-13', low: 70, high: 74 },
    ]);
    expect(detectHighTightFlag(data)).toBeNull();
  });

  it('ポール期間が 8 週間を超えたら検出しない', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      // 70 日 (10週) かけて 110% 上昇。O'Neil の定義は「8 週間以内」。
      { date: '2026-03-16', low: 100, high: 105 },
      { date: '2026-03-20', low: 90, high: 95 },
      { date: '2026-04-10', low: 88, high: 92 },
    ]);
    expect(detectHighTightFlag(data)).toBeNull();
  });

  it('フラッグの下落が 25% を超えたら検出しない', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      { date: '2026-02-16', low: 100, high: 105 },
      { date: '2026-02-20', low: 80, high: 85 },
      { date: '2026-03-02', low: 70, high: 75 }, // 105 から 33% 下落
      { date: '2026-03-13', low: 72, high: 76 },
    ]);
    expect(detectHighTightFlag(data)).toBeNull();
  });

  it('フラッグ期間が 3 週間未満 (まだ形成中) なら検出しない', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      { date: '2026-02-16', low: 100, high: 105 },
      { date: '2026-02-20', low: 95, high: 98 },
      { date: '2026-02-25', low: 92, high: 96 }, // ポール高値から 9 日 = 1.3 週
    ]);
    expect(detectHighTightFlag(data)).toBeNull();
  });

  it('フラッグ期間が 5 週間を超えたら検出しない (保ち合いが崩れたとみなす)', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      { date: '2026-02-16', low: 100, high: 105 },
      { date: '2026-02-20', low: 92, high: 96 },
      { date: '2026-04-01', low: 90, high: 94 }, // ポール高値から 44 日 = 6.3 週
    ]);
    expect(detectHighTightFlag(data)).toBeNull();
  });

  it('観測が 1 件以下なら検出しない', () => {
    expect(detectHighTightFlag([])).toBeNull();
    expect(detectHighTightFlag(bars([{ date: '2026-01-05', low: 50, high: 52 }]))).toBeNull();
  });

  it('出来高が減っていなければ volumeDecreased は false', () => {
    const data = bars([
      { date: '2026-01-05', low: 50, high: 52, volume: 500 },
      { date: '2026-02-16', low: 100, high: 105, volume: 600 },
      { date: '2026-02-20', low: 90, high: 95, volume: 900 }, // ポールより出来高が多い
      { date: '2026-03-13', low: 88, high: 92, volume: 950 },
    ]);
    const result = detectHighTightFlag(data);
    expect(result).not.toBeNull();
    expect(result!.volumeDecreased).toBe(false);
  });
});

describe('toSortedBars', () => {
  it('観測 (Record) を日付昇順の配列に変換する', () => {
    const observations: Record<string, OhlcvBar> = {
      '2026-02-01': bar({ high: 2, low: 1 }),
      '2026-01-01': bar({ high: 1, low: 0.5 }),
    };
    expect(toSortedBars(observations).map((b) => b.date)).toEqual(['2026-01-01', '2026-02-01']);
  });
});
