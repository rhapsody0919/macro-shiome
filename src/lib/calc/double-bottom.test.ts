import { describe, expect, it } from 'vitest';
import { detectDoubleBottom } from './double-bottom';
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

function d(offset: number): string {
  const date = new Date('2026-01-01T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

// 典型例: 安値 A (50, index6) → ネックライン B (80, index13) → 安値 C (51, index20、
// A とほぼ同水準)。findPivots の既定 (前後6本) でピボットとして検出されるよう、
// 各点の前後に十分な幅を持たせてある。
const TYPICAL: Array<{ date: string } & Parameters<typeof bar>[0]> = [
  { date: d(0), low: 63, high: 68 },
  { date: d(1), low: 62, high: 67 },
  { date: d(2), low: 61, high: 66 },
  { date: d(3), low: 60, high: 65 },
  { date: d(4), low: 59, high: 64 },
  { date: d(5), low: 58, high: 63 },
  { date: d(6), low: 50, high: 55, volume: 3000 }, // A (1つ目の安値)
  { date: d(7), low: 53, high: 58 },
  { date: d(8), low: 56, high: 61 },
  { date: d(9), low: 59, high: 64 },
  { date: d(10), low: 62, high: 67 },
  { date: d(11), low: 65, high: 70 },
  { date: d(12), low: 68, high: 73 },
  { date: d(13), low: 70, high: 80 }, // ネックライン
  { date: d(14), low: 65, high: 75 },
  { date: d(15), low: 62, high: 70 },
  { date: d(16), low: 59, high: 65 },
  { date: d(17), low: 56, high: 60 },
  { date: d(18), low: 53, high: 57 },
  { date: d(19), low: 52, high: 55 },
  { date: d(20), low: 51, high: 54, volume: 1500 }, // C (2つ目の安値、A とほぼ同水準)
  { date: d(21), low: 53, high: 58 },
  { date: d(22), low: 55, high: 60 },
  { date: d(23), low: 57, high: 62 },
  { date: d(24), low: 59, high: 64 },
  { date: d(25), low: 61, high: 66 },
  { date: d(26), low: 63, high: 68 },
];

describe('detectDoubleBottom (#256)', () => {
  it('典型的なダブルボトムを検出する', () => {
    const result = detectDoubleBottom(bars(TYPICAL));
    expect(result).not.toBeNull();
    expect(result!.firstBottomDate).toBe(d(6));
    expect(result!.firstBottomPrice).toBe(50);
    expect(result!.necklineDate).toBe(d(13));
    expect(result!.necklinePrice).toBe(80);
    expect(result!.secondBottomDate).toBe(d(20));
    expect(result!.secondBottomPrice).toBe(51);
    expect(result!.volumeDecreased).toBe(true);
  });

  it('2つの安値の差が平均バー幅の0.5倍を超えたら検出しない', () => {
    const farApart = TYPICAL.map((b) => (b.date === d(20) ? { ...b, low: 30, high: 34 } : b));
    expect(detectDoubleBottom(bars(farApart))).toBeNull();
  });

  it('2つの安値の間に高値ピボットが無ければ検出しない', () => {
    // 区間 (index7〜19) の高値をなだらかにし、ピボット高値が立たないようにする。
    const noNeckline = TYPICAL.map((b, i) =>
      i >= 7 && i <= 19 ? { ...b, high: 56, low: 52 } : b,
    );
    expect(detectDoubleBottom(bars(noNeckline))).toBeNull();
  });

  it('観測が少なすぎればピボットが検出できず null を返す', () => {
    expect(detectDoubleBottom(bars(TYPICAL.slice(0, 10)))).toBeNull();
  });

  it('2番目の安値の形成後に一度でもネックラインを超えていたら検出しない (既にブレイクアウト済み)', () => {
    // index23 (C=index20 より後、基準日より前) の終値をネックライン (80) 超えにする。
    // 基準日 (index26) の終値自体は範囲内 (68) に戻っているが、経路の途中で
    // 上抜けている以上パターンは既に解決済みとみなし、検出してはいけない。
    const brokenOut = TYPICAL.map((b) =>
      b.date === d(23) ? { ...b, low: 80, high: 85 } : b,
    );
    expect(detectDoubleBottom(bars(brokenOut))).toBeNull();
  });

  it('2番目の安値の形成後に一度でも安値を割っていたら検出しない (下抜け済み)', () => {
    // index22 (C=index20 より後、基準日より前) の終値を C (51) 未満にする。
    // 基準日 (index26) の終値は範囲内に戻っているが、経路の途中で 2 番目の
    // 安値を割っている以上「反発の途中」ではないため検出してはいけない。
    const undercut = TYPICAL.map((b) =>
      b.date === d(22) ? { ...b, low: 40, high: 45 } : b,
    );
    expect(detectDoubleBottom(bars(undercut))).toBeNull();
  });

  it('A〜C 間に両安値より深い安値があれば検出しない (実データで発見した欠陥)', () => {
    // index13 (ネックライン、A=index6 と C=index20 の間) の安値を 30 まで下げる。
    // high (ネックライン判定に使う値) は 80 のまま変えていないので、ネックライン
    // 自体の判定には影響しない。安値だけが両底 (50, 51) より大幅に低くなるため、
    // 「その区間で最も深い 2 点が A と C であること」という W 字の前提が崩れる。
    const deeperMiddle = TYPICAL.map((b) => (b.date === d(13) ? { ...b, low: 30 } : b));
    expect(detectDoubleBottom(bars(deeperMiddle))).toBeNull();
  });
});
