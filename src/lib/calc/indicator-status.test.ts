import { describe, expect, it } from 'vitest';
import { buildIndicatorStatusView } from './indicator-status';
import type { Gap, IndicatorMaster } from '../data/types';

const INDICATORS: IndicatorMaster = {
  a: { name: '指標A', frequency: 'weekly' } as IndicatorMaster[string],
  b: { name: '指標B', frequency: 'monthly' } as IndicatorMaster[string],
  c: { name: '指標C', frequency: 'weekly' } as IndicatorMaster[string],
};

describe('buildIndicatorStatusView (#330)', () => {
  it('直近5件の観測日を新しい順に並べる', () => {
    const observations = {
      a: {
        '2026-01-01': 1,
        '2026-01-08': 1,
        '2026-01-15': 1,
        '2026-01-22': 1,
        '2026-01-29': 1,
        '2026-02-05': 1,
      },
    };
    const view = buildIndicatorStatusView(INDICATORS, observations, [], '2026-02-06T00:00:00.000Z');
    const entry = view.entries.find((e) => e.indicatorId === 'a');
    expect(entry?.recentDates).toEqual([
      '2026-02-05',
      '2026-01-29',
      '2026-01-22',
      '2026-01-15',
      '2026-01-08',
    ]);
  });

  it('観測が無ければ空配列を返す', () => {
    const view = buildIndicatorStatusView(INDICATORS, {}, [], '2026-02-06T00:00:00.000Z');
    const entry = view.entries.find((e) => e.indicatorId === 'b');
    expect(entry?.recentDates).toEqual([]);
  });

  it('指標ごとに頻度をそのまま反映する', () => {
    const view = buildIndicatorStatusView(INDICATORS, {}, [], '2026-02-06T00:00:00.000Z');
    expect(view.entries.find((e) => e.indicatorId === 'a')?.frequency).toBe('weekly');
    expect(view.entries.find((e) => e.indicatorId === 'b')?.frequency).toBe('monthly');
  });

  it('最新の観測日より新しい欠測だけを「いま関係がある」として出す', () => {
    const observations = { a: { '2026-01-01': 1 } };
    const gaps: Gap[] = [
      // 観測より古い欠測は解消済みなので出さない。
      { indicatorId: 'a', date: '2025-12-01', reason: 'fetch-failed', recordedAt: 'x' },
      // 観測より新しい欠測は「いま止まっている」ので出す。
      {
        indicatorId: 'a',
        date: '2026-01-08',
        reason: 'fetch-failed',
        detail: '取得に失敗した',
        recordedAt: 'x',
      },
    ];
    const view = buildIndicatorStatusView(INDICATORS, observations, gaps, '2026-01-09T00:00:00.000Z');
    expect(view.entries.find((e) => e.indicatorId === 'a')?.gapReason).toBe('取得に失敗した');
  });

  it('観測より古い欠測しか無ければ理由を出さない', () => {
    const observations = { a: { '2026-01-08': 1 } };
    const gaps: Gap[] = [
      { indicatorId: 'a', date: '2025-12-01', reason: 'fetch-failed', recordedAt: 'x' },
    ];
    const view = buildIndicatorStatusView(INDICATORS, observations, gaps, '2026-01-09T00:00:00.000Z');
    expect(view.entries.find((e) => e.indicatorId === 'a')?.gapReason).toBeNull();
  });

  it('detail が無ければ reason を使う', () => {
    const gaps: Gap[] = [{ indicatorId: 'c', date: '2026-02-01', reason: 'not-in-report', recordedAt: 'x' }];
    const view = buildIndicatorStatusView(INDICATORS, {}, gaps, '2026-02-06T00:00:00.000Z');
    expect(view.entries.find((e) => e.indicatorId === 'c')?.gapReason).toBe('not-in-report');
  });
});
