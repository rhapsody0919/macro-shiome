import { describe, expect, it } from 'vitest';
import { parse52WeekHigh, parsePrice } from './finnhub';

describe('現在値 (#128)', () => {
  it('c を取り出す', () => {
    expect(parsePrice({ c: 762.6 }, 'SPY')).toBe(762.6);
  });

  // 存在しない symbol でも 200 と {"c":0} が返る。0 を保存すると
  // 「株価がゼロ」というありえない観測が静かに溜まる。
  it('0 以下なら落ちる', () => {
    expect(() => parsePrice({ c: 0 }, 'GXG')).toThrow(/0 以下/);
  });
});

describe('52 週高値 (#224)', () => {
  it('高値と日付を取り出す', () => {
    const body = { metric: { '52WeekHigh': 779.37, '52WeekHighDate': '2026-08-13' } };
    expect(parse52WeekHigh(body, 'SPY')).toEqual({ high: 779.37, date: '2026-08-13' });
  });

  it('metric が無ければ落ちる', () => {
    expect(() => parse52WeekHigh({}, 'SPY')).toThrow(/metric が無い/);
  });

  // 存在しない symbol でも 200 が返るのは現在値と同じ。
  // 空を「高値ゼロ」として通すと検算が意味を失う。
  it('高値が 0 以下なら落ちる', () => {
    expect(() => parse52WeekHigh({ metric: { '52WeekHigh': 0 } }, 'SPY')).toThrow(
      /52 週高値が数値でない/,
    );
  });

  it('日付の形式が違えば落ちる', () => {
    const body = { metric: { '52WeekHigh': 779.37, '52WeekHighDate': '2026/08/13' } };
    expect(() => parse52WeekHigh(body, 'SPY')).toThrow(/日付が不正/);
  });
});
