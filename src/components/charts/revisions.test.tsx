import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RevisionPoint } from '@/lib/data/types';
import { revisionPoint as point } from '@/test/fixtures';
import { RevisionsChart } from './revisions';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

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

describe('暦年と四半期の切替 (#117)', () => {
  const revisions: RevisionPoint[] = [
    point('2026-08-07', {
      growthCurrentYear: 30.0,
      growthNextYear: 13.6,
      growthNextQuarter: 12.4,
      growthQuarterAfterNext: 15.1,
    }),
  ];

  it('既定は暦年', () => {
    render(<RevisionsChart revisions={revisions} />);
    expect(screen.getByRole('button', { name: '暦年' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('四半期に切り替えると対象が入れ替わる旨の注記が出る', () => {
    // 暦年は年内固定、四半期は進むと別の四半期を指す。読み方が違う。
    render(<RevisionsChart revisions={revisions} />);
    expect(document.body.textContent).not.toContain('四半期は対象が入れ替わる');

    act(() => {
      screen.getByRole('button', { name: '四半期' }).click();
    });
    expect(document.body.textContent).toContain('四半期は対象が入れ替わる');
    expect(screen.getByRole('button', { name: '四半期' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('blended との違いを四半期表示のときに明示する', () => {
    // 3 時点の blended は実績と予想の混合。純粋な予想と混同されやすい。
    render(<RevisionsChart revisions={revisions} />);
    act(() => {
      screen.getByRole('button', { name: '四半期' }).click();
    });
    expect(document.body.textContent).toContain('進行中四半期の blended 増益率');
  });
});
