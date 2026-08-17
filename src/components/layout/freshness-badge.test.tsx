import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Freshness } from '@/lib/data/loader';
import { FreshnessBadge } from './freshness-badge';

function freshness(gaps: Freshness['recentGaps']): Freshness {
  return {
    lastSuccessAt: '2026-08-17T00:00:00.000Z',
    daysSinceSuccess: 0,
    recentGaps: gaps,
    isStale: false,
  };
}

const gap = (date: string, reason: 'publication-break' | 'not-in-report' | 'fetch-failed') => ({
  indicatorId: 'x',
  date,
  reason,
  recordedAt: '2026-08-17T00:00:00.000Z',
});

describe('鮮度表示の欠測 (#77)', () => {
  it('正常な欠測は件数だけ出す', () => {
    // 休刊は仕様どおりの状態。日付を並べても行動につながらず、
    // 毎回ヘッダーを占有すると本当に見るべき欠測が埋もれる。
    render(
      <FreshnessBadge
        freshness={freshness([
          gap('2026-08-14', 'publication-break'),
          gap('2026-08-14', 'publication-break'),
          gap('2026-07-03', 'not-in-report'),
        ])}
      />,
    );
    expect(screen.getByText(/直近の欠測 3 件/)).toBeInTheDocument();
    expect(screen.getByText(/異常ではない/)).toBeInTheDocument();
    expect(screen.queryByText(/取得失敗/)).not.toBeInTheDocument();
  });

  it('取得失敗は日付つきで警告色にする', () => {
    render(<FreshnessBadge freshness={freshness([gap('2026-08-14', 'fetch-failed')])} />);
    expect(screen.getByText(/取得失敗/)).toBeInTheDocument();
    expect(screen.getByText(/2026\/08\/14/)).toBeInTheDocument();
  });

  it('両方あれば要調査を分けて出す', () => {
    render(
      <FreshnessBadge
        freshness={freshness([
          gap('2026-08-14', 'publication-break'),
          gap('2026-08-14', 'fetch-failed'),
        ])}
      />,
    );
    expect(screen.getByText(/取得失敗/)).toBeInTheDocument();
    expect(screen.getByText(/直近の欠測 1 件/)).toBeInTheDocument();
  });

  it('欠測が無ければ何も出さない', () => {
    render(<FreshnessBadge freshness={freshness([])} />);
    expect(screen.queryByText(/欠測/)).not.toBeInTheDocument();
  });
});
