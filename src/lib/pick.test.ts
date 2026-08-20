import { describe, expect, it } from 'vitest';
import { pickLatest, stepLabel } from './pick';

interface Point {
  date: string;
  value: number | null;
}

const valueOf = (p: Point) => p.value;
const keyOf = (p: Point) => p.date;

describe('pickLatest', () => {
  it('最新値と直前との差を返す', () => {
    const points: Point[] = [
      { date: '2026-08-07', value: 2.6 },
      { date: '2026-08-14', value: 2.9 },
    ];
    const result = pickLatest(points, valueOf, keyOf);
    expect(result.value).toBe(2.9);
    expect(result.delta).toBeCloseTo(0.3, 6);
    expect(result.stepsBack).toBe(1);
    expect(result.at).toBe('2026-08-14');
  });

  it('欠測を跨いだら何点前かを返す', () => {
    // 「前週比」と表示すると実際は 2 週分の変化なのに 1 週分と誤解される (plan U-S3)。
    const points: Point[] = [
      { date: '2026-08-01', value: 2.0 },
      { date: '2026-08-08', value: null },
      { date: '2026-08-15', value: 2.4 },
    ];
    const result = pickLatest(points, valueOf, keyOf);
    expect(result.delta).toBeCloseTo(0.4, 6);
    expect(result.stepsBack).toBe(2);
  });

  it('値が 1 つだけなら差分は出さない', () => {
    const result = pickLatest([{ date: '2026-08-14', value: 5 }], valueOf, keyOf);
    expect(result.value).toBe(5);
    expect(result.delta).toBeNull();
    expect(result.at).toBe('2026-08-14');
  });

  it('値が 1 つも無ければすべて null', () => {
    const result = pickLatest([{ date: '2026-08-14', value: null }], valueOf, keyOf);
    expect(result.value).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.at).toBeNull();
  });

  it('末尾が欠測でも値を持つ最後の点を採る', () => {
    // 月次は直近 1〜2 か月が未発表なので、末尾が欠測なのが通常の状態。
    const points: Point[] = [
      { date: '2026-06-01', value: 3.5 },
      { date: '2026-07-01', value: null },
      { date: '2026-08-01', value: null },
    ];
    const result = pickLatest(points, valueOf, keyOf);
    expect(result.value).toBe(3.5);
    expect(result.at).toBe('2026-06-01');
  });

  it('0 を欠測として扱わない', () => {
    const points: Point[] = [
      { date: '2026-08-07', value: 0.5 },
      { date: '2026-08-14', value: 0 },
    ];
    expect(pickLatest(points, valueOf, keyOf).value).toBe(0);
  });
});

describe('stepLabel', () => {
  it('直前なら「前週比」', () => {
    expect(stepLabel(1, '週')).toBe('前週比');
    expect(stepLabel(1, '月')).toBe('前月比');
  });

  it('飛んでいたら何回前かを出す', () => {
    expect(stepLabel(3, '週')).toBe('3週前比');
    // 「2月前比」だと読みにくいので「2か月前比」にする。
    expect(stepLabel(2, '月')).toBe('2か月前比');
  });
  it('日次にも使える (#186)', () => {
    // 日本ページの日経平均が初の日次カード。欠測を跨げば何日前かを出す。
    expect(stepLabel(1, '日')).toBe('前日比');
    expect(stepLabel(3, '日')).toBe('3日前比');
  });

});
