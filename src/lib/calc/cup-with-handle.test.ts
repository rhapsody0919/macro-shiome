import { describe, expect, it } from 'vitest';
import { detectCupWithHandle } from './cup-with-handle';
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

// 典型例: 上昇トレンド (50→100) → カップ (100→80→98、12週、深さ40%) →
// ハンドル (2週、92 でカップ中間点 90 以上を維持)。
// **ハンドル期間の観測点は基準日 1 本に絞る。** 中間点を増やすと、それ自体が
// 「別のより短いカップの右リム」として解釈されてしまい検出結果が曖昧になる
// (実装時に実測して判明。findBestCup は複数の妥当な解釈があると最大のカップを
// 優先するが、右リム候補の探索順序までは制御できないため)。
const TYPICAL: Array<{ date: string } & Parameters<typeof bar>[0]> = [
  { date: '2026-01-05', low: 50, high: 52, volume: 3000 }, // 上昇トレンドの起点
  { date: '2026-01-20', low: 60, high: 75, volume: 2800 },
  { date: '2026-02-02', low: 95, high: 100, volume: 2600 }, // 左リム
  { date: '2026-02-20', low: 88, high: 92, volume: 900 },
  { date: '2026-03-16', low: 80, high: 85, volume: 800 }, // カップ底
  { date: '2026-04-01', low: 85, high: 90, volume: 1400 },
  { date: '2026-04-27', low: 93, high: 98, volume: 1600 }, // 右リム
  { date: '2026-05-11', low: 92, high: 95, volume: 500 }, // 基準日 (ハンドル、2週間後)
];

describe('detectCupWithHandle (#230)', () => {
  it('典型的なカップウィズハンドルを検出する', () => {
    const result = detectCupWithHandle(bars(TYPICAL));

    expect(result).not.toBeNull();
    expect(result!.cup.leftRimDate).toBe('2026-02-02');
    expect(result!.cup.leftRimPrice).toBe(100);
    expect(result!.cup.cupBottomDate).toBe('2026-03-16');
    expect(result!.cup.cupBottomPrice).toBe(80);
    expect(result!.cup.rightRimDate).toBe('2026-04-27');
    expect(result!.cup.rightRimPrice).toBe(98);
    // previousAdvance = 100 - 50 = 50、cupDepth = 100 - 80 = 20 → 40%
    expect(result!.cup.depthPercent).toBeCloseTo(40, 5);
    expect(result!.cup.weeks).toBeCloseTo(12, 5);
    expect(result!.handleStart).toBe('2026-05-11');
    expect(result!.handleEnd).toBe('2026-05-11');
    expect(result!.handleWeeks).toBeCloseTo(2, 5);
    expect(result!.handleInUpperHalf).toBe(true);
  });

  it('深さが 2/3 を超えたら検出しない', () => {
    const deep = TYPICAL.map((b) => (b.date === '2026-03-16' ? { ...b, low: 60, high: 62 } : b));
    // previousAdvance = 50、cupDepth = 100 - 60 = 40 → 80% > 66.7%
    expect(detectCupWithHandle(bars(deep))).toBeNull();
  });

  it('カップ期間が 7 週未満なら検出しない', () => {
    // 左リム→右リムが 3 週間 (7 週未満)。カップ期間はカップ底の位置ではなく
    // 左リム・右リムの間隔で決まるため、独立したデータセットで検証する。
    const short = bars([
      { date: '2026-01-05', low: 50, high: 52 },
      { date: '2026-01-20', low: 95, high: 100 }, // 左リム
      { date: '2026-01-27', low: 80, high: 85 }, // カップ底
      { date: '2026-02-10', low: 93, high: 98 }, // 右リム (左リムから 3 週間後)
      { date: '2026-02-24', low: 92, high: 95 }, // 基準日 (ハンドル、2 週間後)
    ]);
    expect(detectCupWithHandle(short)).toBeNull();
  });

  it('カップ期間が 65 週を超えたら検出しない', () => {
    const long = TYPICAL.map((b) => {
      if (b.date === '2026-02-02') return { ...b, date: '2024-01-05' }; // 左リムを大幅に前に
      return b;
    });
    expect(detectCupWithHandle(bars(long))).toBeNull();
  });

  it('右リムが左リムの 95% 未満なら検出しない', () => {
    const weak = TYPICAL.map((b) => (b.date === '2026-04-27' ? { ...b, low: 85, high: 90 } : b));
    // 90 / 100 = 90% < 95%
    expect(detectCupWithHandle(bars(weak))).toBeNull();
  });

  it('ハンドルがカップ中間点より下なら検出しない', () => {
    const belowMid = TYPICAL.map((b) =>
      b.date === '2026-05-11' ? { ...b, low: 70, high: 75 } : b,
    );
    // cupMidpoint = (100+80)/2 = 90、70 < 90
    expect(detectCupWithHandle(bars(belowMid))).toBeNull();
  });

  it('ハンドル期間が 1 週未満 (まだ形成中) なら検出しない', () => {
    const tooShort = TYPICAL.filter((b) => b.date !== '2026-05-11').concat([
      { date: '2026-04-29', low: 93, high: 96, volume: 500 }, // 右リムから 2 日後
    ]);
    expect(detectCupWithHandle(bars(tooShort))).toBeNull();
  });

  it('ハンドル期間が 4 週を超えたら検出しない', () => {
    const tooLong = TYPICAL.filter((b) => b.date !== '2026-05-11').concat([
      { date: '2026-06-05', low: 92, high: 95, volume: 500 }, // 右リムから 39 日後 = 5.6 週
    ]);
    expect(detectCupWithHandle(bars(tooLong))).toBeNull();
  });

  it('観測が 1 件以下なら検出しない', () => {
    expect(detectCupWithHandle([])).toBeNull();
    expect(detectCupWithHandle(bars([{ date: '2026-01-05', low: 50, high: 52 }]))).toBeNull();
  });

  it('出来高判定: カップ形成中に減少しリバウンドで増加していれば volumeDecreasedDuringCup は true', () => {
    const result = detectCupWithHandle(bars(TYPICAL));
    expect(result).not.toBeNull();
    // 左半分 (2026-02-02〜03-16): 2600,900,800 の平均 = 1433.3
    // 右半分 (2026-03-16〜04-27): 800,1400,1600 の平均 = 1266.7
    expect(result!.volumeDecreasedDuringCup).toBe(true);
  });

  it('ハンドルの出来高がカップ全体より少なければ handleVolumeLight は true', () => {
    const result = detectCupWithHandle(bars(TYPICAL));
    expect(result).not.toBeNull();
    expect(result!.handleVolumeLight).toBe(true);
  });
});
