import { describe, expect, it } from 'vitest';
import { fridaysBetween, sameDayLastYear, valueAsOf, valueOn } from './weeks';

describe('fridaysBetween', () => {
  it('期間内の金曜日を昇順で返す', () => {
    // 2026-08-07 と 08-14 と 08-21 は金曜。
    expect(fridaysBetween('2026-08-03', '2026-08-23')).toEqual([
      '2026-08-07',
      '2026-08-14',
      '2026-08-21',
    ]);
  });

  it('開始日が金曜ならその日を含む', () => {
    expect(fridaysBetween('2026-08-07', '2026-08-07')).toEqual(['2026-08-07']);
  });

  it('金曜を含まない期間では空になる', () => {
    expect(fridaysBetween('2026-08-08', '2026-08-13')).toEqual([]);
  });

  it('年をまたげる', () => {
    const weeks = fridaysBetween('2026-12-25', '2027-01-10');
    expect(weeks).toContain('2026-12-25');
    expect(weeks).toContain('2027-01-01');
    expect(weeks).toContain('2027-01-08');
  });
});

describe('valueAsOf', () => {
  const observations = { '2026-08-12': 100, '2026-08-14': 110 };

  it('その日の値があればそれを返す', () => {
    expect(valueAsOf(observations, '2026-08-14')).toBe(110);
  });

  it('休場日は直近の営業日まで遡る', () => {
    // 金曜が休場なら木曜以前の値を使う。
    expect(valueAsOf(observations, '2026-08-13')).toBe(100);
  });

  it('遡る範囲を超えたら欠測にする', () => {
    // 古い値を「その週の値」として使い回すと欠測が見えなくなる。
    expect(valueAsOf(observations, '2026-08-25', 7)).toBeNull();
  });

  it('データが無ければ null', () => {
    expect(valueAsOf({}, '2026-08-14')).toBeNull();
  });
});

describe('valueOn', () => {
  const observations = { '2026-08-07': 20.0 };

  it('その日ちょうどの値だけを返す', () => {
    expect(valueOn(observations, '2026-08-07')).toBe(20.0);
  });

  it('遡らない', () => {
    // 週次系列で遡ると、休刊週が前週の値で埋まって欠測が見えなくなる。
    expect(valueOn(observations, '2026-08-14')).toBeNull();
  });
});

describe('sameDayLastYear', () => {
  it('通常の日付は年だけ引く', () => {
    expect(sameDayLastYear('2026-08-20')).toBe('2025-08-20');
    expect(sameDayLastYear('2024-03-01')).toBe('2023-03-01');
  });

  // #206: 文字列で年だけ引くと存在しない 2023-02-29 になり、new Date が 3/1 に
  // ロールオーバーする。valueAsOf は過去へしか遡らないので前年 3/1 の値を拾っていた。
  it('うるう日は前年 2/28 に丸める', () => {
    expect(sameDayLastYear('2024-02-29')).toBe('2023-02-28');
  });

  it('うるう日の前年同日比は 2/28 の値を使う', () => {
    const points = { '2023-02-28': 100, '2023-03-01': 80, '2024-02-29': 120 };
    expect(valueAsOf(points, sameDayLastYear('2024-02-29'))).toBe(100);
  });
});
