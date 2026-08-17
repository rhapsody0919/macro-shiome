import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RevisionPoint } from '@/lib/data/types';
import { RevisionsChart } from './revisions';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function point(date: string, overrides: Partial<RevisionPoint> = {}): RevisionPoint {
  return {
    date,
    blendedToday: null,
    blendedLastWeek: null,
    blendedQuarterEnd: null,
    growthCurrentYear: null,
    growthNextYear: null,
    ...overrides,
  };
}

describe('予想改定の欠測説明 (#53)', () => {
  /**
   * 実データの形を模した系列。
   * 翌暦年は年央から載り始める (2026-06-12 より前は null)。
   */
  const revisions: RevisionPoint[] = [
    point('2026-01-09', { growthCurrentYear: 14.9 }),
    point('2026-02-20'), // 休刊週
    point('2026-03-06', { growthCurrentYear: 15.0 }),
    point('2026-06-12', { growthCurrentYear: 23.2, growthNextYear: 16.2 }),
    point('2026-08-07', { growthCurrentYear: 30.0, growthNextYear: 13.6 }),
  ];

  it('線が途切れる 3 つの理由を示す', () => {
    const { container } = render(<RevisionsChart revisions={revisions} />);
    const text = container.textContent ?? '';
    expect(text).toContain('線が途切れる理由は 3 つある');
    expect(text).toContain('提供元にその期間が無い');
    expect(text).toContain('休刊週');
    expect(text).toContain('その号に記載が無い');
  });

  it('翌暦年が年前半に無いのは正常だと明記する', () => {
    // これが無いと「取得に失敗している」と読まれる。
    const { container } = render(<RevisionsChart revisions={revisions} />);
    expect(container.textContent).toContain('翌暦年 (紫) は年前半の号に載らない');
    expect(container.textContent).toContain('年前半で線が無いのは正常');
  });

  it('提供元のデータ開始日を出す', () => {
    render(<RevisionsChart revisions={revisions} />);
    expect(screen.getByText(/2026\/01\/09 以降しか取得できない/)).toBeInTheDocument();
  });

  it('開始日は期間フィルターに影響されない', () => {
    // フィルター後の最初の日を使うと「絞った範囲の下限」と提供元の下限が混同される。
    // 全期間の系列から取ることで、フィルターを変えても表示が変わらない。
    const older = [point('2021-09-03', { growthCurrentYear: 9.1 }), ...revisions];
    render(<RevisionsChart revisions={older} />);
    expect(screen.getByText(/2021\/09\/03 以降しか取得できない/)).toBeInTheDocument();
  });

  it('データが 1 件も無くても落ちない', () => {
    const { container } = render(<RevisionsChart revisions={[point('2026-01-09')]} />);
    expect(container.textContent).toContain('取得できる期間の下限がある');
  });
});
