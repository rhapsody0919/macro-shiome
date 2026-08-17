import { describe, expect, it } from 'vitest';
import { describeGapReason, needsInvestigation, summarizeGaps, toFreshness } from './loader';
import type { BatchStatus, Gap } from './types';

const now = new Date('2026-08-16T00:00:00Z');

function status(overrides: Partial<BatchStatus> = {}): BatchStatus {
  return {
    lastSuccessAt: '2026-08-15T02:00:00Z',
    lastRunAt: '2026-08-15T02:00:00Z',
    recentGaps: [],
    ...overrides,
  };
}

function gap(date: string, reason: Gap['reason'] = 'publication-break', id = 'x'): Gap {
  return { indicatorId: id, date, reason, recordedAt: now.toISOString() };
}

describe('toFreshness', () => {
  it('最終成功からの日数を出す', () => {
    expect(toFreshness(status(), now).daysSinceSuccess).toBe(0);
    expect(toFreshness(status({ lastSuccessAt: '2026-08-10T02:00:00Z' }), now).daysSinceSuccess).toBe(5);
  });

  it('10 日以内なら警告しない', () => {
    // 週次更新なので 1 週間程度の間隔は正常。
    expect(toFreshness(status({ lastSuccessAt: '2026-08-09T02:00:00Z' }), now).isStale).toBe(false);
  });

  it('10 日を超えたら警告する', () => {
    // 1 回分の取得が落ちている可能性が高い。古いデータを最新と誤認させない。
    expect(toFreshness(status({ lastSuccessAt: '2026-08-04T02:00:00Z' }), now).isStale).toBe(true);
  });

  it('一度も成功していなければ警告する', () => {
    const freshness = toFreshness(status({ lastSuccessAt: null }), now);
    expect(freshness.isStale).toBe(true);
    expect(freshness.daysSinceSuccess).toBeNull();
  });
});

describe('summarizeGaps', () => {
  it('同じ日・同じ理由をまとめる', () => {
    // FactSet が休刊すると 14 指標すべてに欠測が付く。そのまま並べると読めない。
    const gaps = [gap('2026-08-14', 'publication-break', 'a'), gap('2026-08-14', 'publication-break', 'b')];
    expect(summarizeGaps(gaps)).toEqual([
      { date: '2026-08-14', reason: 'publication-break', count: 2 },
    ]);
  });

  it('理由が違えば分ける', () => {
    // 休刊と取得失敗は意味が違う。区別して見せる必要がある。
    const gaps = [gap('2026-08-14', 'publication-break'), gap('2026-08-14', 'fetch-failed')];
    expect(summarizeGaps(gaps)).toHaveLength(2);
  });

  it('新しい日付を先頭にする', () => {
    const result = summarizeGaps([gap('2026-08-07'), gap('2026-08-14')]);
    expect(result[0].date).toBe('2026-08-14');
  });

  it('空配列を扱える', () => {
    expect(summarizeGaps([])).toEqual([]);
  });
});

describe('describeGapReason', () => {
  it('3 種類の理由を区別する', () => {
    expect(describeGapReason('publication-break')).toBe('レポート休刊');
    expect(describeGapReason('not-in-report')).toBe('この号に記載なし');
    expect(describeGapReason('fetch-failed')).toBe('取得失敗');
  });
});

describe('needsInvestigation', () => {
  it('取得失敗だけが要調査', () => {
    // 休刊と掲載無しは提供元の仕様どおりで異常ではない。同列に警告すると
    // 本当に見るべき取得失敗が埋もれる (#53)。
    expect(needsInvestigation('fetch-failed')).toBe(true);
    expect(needsInvestigation('publication-break')).toBe(false);
    expect(needsInvestigation('not-in-report')).toBe(false);
  });
});
