import { describe, expect, it } from 'vitest';
import { latestMonthWithValue, monthsBetween, valueForMonth, yearAgo } from './months';

describe('monthsBetween', () => {
  it('月初を昇順で返す', () => {
    expect(monthsBetween('2026-01-15', '2026-04-01')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
  });

  it('年をまたぐ', () => {
    expect(monthsBetween('2025-11-01', '2026-02-01')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });

  it('同じ月なら 1 件', () => {
    expect(monthsBetween('2026-06-10', '2026-06-25')).toEqual(['2026-06-01']);
  });

  it('開始が終了より後なら空', () => {
    expect(monthsBetween('2026-06-01', '2026-05-01')).toEqual([]);
  });
});

describe('yearAgo', () => {
  it('12 か月前の月初を返す', () => {
    expect(yearAgo('2026-06-01')).toBe('2025-06-01');
  });

  it('1 月は前年の 1 月', () => {
    expect(yearAgo('2026-01-01')).toBe('2025-01-01');
  });
});

describe('valueForMonth', () => {
  const observations = { '2026-05-01': 150.3, '2026-06-01': 150.8 };

  it('対象月の値を返す', () => {
    expect(valueForMonth(observations, '2026-06-01')).toBe(150.8);
  });

  it('日付部分が違っても月で引ける', () => {
    // 週次グリッドから月次を引くときに日付がずれることがある。
    expect(valueForMonth(observations, '2026-06-15')).toBe(150.8);
  });

  it('遡らない', () => {
    // 遡ると別の月の値を「その月の値」として使ってしまう。
    expect(valueForMonth(observations, '2026-07-01')).toBeNull();
  });
});

describe('latestMonthWithValue', () => {
  const months = ['2026-05-01', '2026-06-01', '2026-07-01'];

  it('値を持つ最後の月を返す', () => {
    // 発表ラグは指標ごとに違う。輸入物価は 6 月分止まりで CPI は 7 月分まで、が実際に起きる。
    expect(latestMonthWithValue(months, { '2026-05-01': 1, '2026-06-01': 2 })).toBe('2026-06-01');
  });

  it('全部揃っていれば最後の月', () => {
    expect(
      latestMonthWithValue(months, { '2026-05-01': 1, '2026-06-01': 2, '2026-07-01': 3 }),
    ).toBe('2026-07-01');
  });

  it('1 件も無ければ null', () => {
    expect(latestMonthWithValue(months, {})).toBeNull();
  });

  it('途中が欠けていても最後の値を見つける', () => {
    expect(latestMonthWithValue(months, { '2026-05-01': 1, '2026-07-01': 3 })).toBe('2026-07-01');
  });
});
