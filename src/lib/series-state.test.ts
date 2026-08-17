import { describe, expect, it } from 'vitest';
import { MIN_WEEKS_FOR_LINE, describeAccumulation, seriesState, withValue } from './series-state';

/** 値を持つ点と欠測を混ぜた系列を作る。 */
function points(values: Array<number | null>): Array<{ date: string; value: number | null }> {
  return values.map((value, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

const pick = (point: { value: number | null }) => point.value;

describe('値を持つ点の抽出', () => {
  it('欠測を落とす', () => {
    expect(withValue(points([1, null, 2]), pick)).toHaveLength(2);
  });

  it('0 は値として残す', () => {
    // イールドスプレッドは 0 を取り得る。falsy 判定で落とすと欠測と区別できなくなる。
    expect(withValue(points([0, null]), pick)).toHaveLength(1);
  });
});

describe('系列の蓄積状況', () => {
  it('空の系列は 0 週分の蓄積中', () => {
    expect(seriesState([], pick)).toEqual({ kind: 'accumulating', count: 0, from: null });
  });

  it('全部欠測でも 0 週分の蓄積中 (点はあるが値が無い)', () => {
    expect(seriesState(points([null, null, null]), pick)).toEqual({
      kind: 'accumulating',
      count: 0,
      from: null,
    });
  });

  it('1 点しか無いと蓄積中', () => {
    // NASDAQ-100 の実績 PER がこの状態 (2026-08 時点で 1 点のみ)。
    expect(seriesState(points([33.62]), pick)).toEqual({
      kind: 'accumulating',
      count: 1,
      from: '2026-01-01',
    });
  });

  it('閾値ちょうどで ok になる', () => {
    const values = Array.from({ length: MIN_WEEKS_FOR_LINE }, () => 1);
    expect(seriesState(points(values), pick)).toEqual({ kind: 'ok', count: MIN_WEEKS_FOR_LINE });
  });

  it('閾値の 1 つ手前は蓄積中', () => {
    const values = Array.from({ length: MIN_WEEKS_FOR_LINE - 1 }, () => 1);
    expect(seriesState(points(values), pick).kind).toBe('accumulating');
  });

  it('欠測は点数に数えない', () => {
    // 点は 10 個あるが値は 3 つ。欠測を数えると誤って ok になる。
    expect(seriesState(points([1, null, null, 2, null, null, 3, null, null, null]), pick)).toEqual({
      kind: 'accumulating',
      count: 3,
      from: '2026-01-01',
    });
  });

  it('from は値を持つ最初の日 (欠測で始まっても正しい)', () => {
    const state = seriesState(points([null, null, 1, 2, 3]), pick);
    expect(state.kind === 'accumulating' && state.from).toBe('2026-01-03');
  });
});

describe('蓄積中の説明文', () => {
  const identity = (date: string) => date;

  it('取得開始日と週数と必要週数を含む', () => {
    const text = describeAccumulation(
      { kind: 'accumulating', count: 1, from: '2026-08-14' },
      '理論値',
      identity,
    );
    expect(text).toContain('理論値');
    expect(text).toContain('2026-08-14');
    expect(text).toContain('1 週分');
    expect(text).toContain(`${MIN_WEEKS_FOR_LINE} 週分`);
  });

  it('1 件も無いときは「蓄積中」と書かない', () => {
    // 蓄積中は「もう始まっている」ことを含意する。1 件も無い状態とは別。
    const text = describeAccumulation(
      { kind: 'accumulating', count: 0, from: null },
      '理論値',
      identity,
    );
    expect(text).toContain('まだ 1 件も取得できていない');
    expect(text).not.toContain('蓄積中');
  });
});
