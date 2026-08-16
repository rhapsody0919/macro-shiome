import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD, filterByPeriod, parsePeriod, periodStartDate } from './period';

describe('parsePeriod', () => {
  it('有効な値をそのまま返す', () => {
    expect(parsePeriod('1y')).toBe('1y');
    expect(parsePeriod('3y')).toBe('3y');
    expect(parsePeriod('5y')).toBe('5y');
    expect(parsePeriod('all')).toBe('all');
  });

  it('大文字でも受け付ける', () => {
    expect(parsePeriod('5Y')).toBe('5y');
  });

  it('未知の値は既定値に落とす', () => {
    // URL を手で編集されても画面が壊れないようにする。
    expect(parsePeriod('10y')).toBe(DEFAULT_PERIOD);
    expect(parsePeriod('')).toBe(DEFAULT_PERIOD);
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod(undefined)).toBe(DEFAULT_PERIOD);
  });
});

describe('periodStartDate', () => {
  const today = new Date(Date.UTC(2026, 7, 16));

  it('年数分さかのぼった日付を返す', () => {
    expect(periodStartDate('1y', today)).toBe('2025-08-16');
    expect(periodStartDate('3y', today)).toBe('2023-08-16');
    expect(periodStartDate('5y', today)).toBe('2021-08-16');
  });

  it('全期間は下限なし', () => {
    expect(periodStartDate('all', today)).toBeNull();
  });

  it('うるう日でも破綻しない', () => {
    // 2024-02-29 の 1 年前は存在しないため、JS の Date は 3/1 に繰り上げる。
    // 期間フィルターの用途では 1 日の差は問題にならないが、挙動を明示しておく。
    const leapDay = new Date(Date.UTC(2024, 1, 29));
    expect(periodStartDate('1y', leapDay)).toBe('2023-03-01');
  });
});

describe('filterByPeriod', () => {
  const today = new Date(Date.UTC(2026, 7, 16));
  const points = [
    { date: '2020-01-01', value: 1 },
    { date: '2024-01-01', value: 2 },
    { date: '2026-01-01', value: 3 },
    { date: '2026-08-15', value: 4 },
  ];

  it('期間内の点だけを残す', () => {
    expect(filterByPeriod(points, '1y', today).map((p) => p.value)).toEqual([3, 4]);
    expect(filterByPeriod(points, '3y', today).map((p) => p.value)).toEqual([2, 3, 4]);
  });

  it('全期間はすべて残す', () => {
    expect(filterByPeriod(points, 'all', today)).toHaveLength(4);
  });

  it('元の配列を破壊しない', () => {
    filterByPeriod(points, '1y', today);
    expect(points).toHaveLength(4);
  });

  it('空配列を扱える', () => {
    expect(filterByPeriod([], '1y', today)).toEqual([]);
  });
});
