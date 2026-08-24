import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HistoricalDistribution, ValuationView } from '@/lib/data/types';
import { valuationPoint, valuationSeries } from '@/test/fixtures';
import { YieldSpreadChart } from './yield-spread';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

/** 実データ (2026-08-07 時点、S&P 500) をもとにした分布。 */
const DISTRIBUTION: HistoricalDistribution = {
  years: 5,
  mean: 3.7,
  sd: 1.23,
  n: 168,
  latest: 2.6,
  latestPercentile: 15.77,
  latestDate: '2026-08-07',
};

function makeView(
  distribution: HistoricalDistribution | null,
  options: { weeks?: number; note?: string | null } = {},
): ValuationView {
  const { weeks = 20, note = null } = options;
  const points = Array.from({ length: weeks }, (_, i) =>
    valuationPoint(`2026-01-${String(i + 1).padStart(2, '0')}`, {
      earningsYield: 5.0,
      realRate: 2.4,
      yieldSpread: 2.6,
    }),
  );
  const series = valuationSeries(points, {
    spreadDistribution: distribution,
    accumulationNote: note,
  });
  return { sp500: series, nasdaq100: series, shillerPe: { points: [], distribution: null } };
}

describe('イールドスプレッドの水準表示 (#52)', () => {
  it('過去分布における現在の位置を出す', () => {
    const { container } = render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    expect(container.textContent).toContain('過去 5 年で下位 16% の水準');
    expect(container.textContent).toContain('n = 168');
  });

  it('平均との差を向きつきで示す', () => {
    // 2.60% は平均 3.70% を 1.10% 下回る。
    const { container } = render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    expect(container.textContent).toContain('平均 3.70% を 1.10% 下回る');
  });

  it('平均を上回るときは向きが反転する', () => {
    const above: HistoricalDistribution = { ...DISTRIBUTION, latest: 5.0, latestPercentile: 88 };
    const { container } = render(<YieldSpreadChart view={makeView(above)} />);
    expect(container.textContent).toContain('平均 3.70% を 1.30% 上回る');
  });

  it('評価語を使わない', () => {
    // 「危険」「割安」などの判断は読み手に委ねる (screens UI/UX 方針 2)。
    const { container } = render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    const summaryAndNotes = container.textContent ?? '';
    for (const word of ['危険水準です', '割安', '買い時', '売り時']) {
      expect(summaryAndNotes).not.toContain(word);
    }
  });

  it('固定の閾値を置いていないことを明示する', () => {
    render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    expect(screen.getByText(/固定の「危険水準」は置いていない/)).toBeInTheDocument();
  });

  it('読み方の説明を出す', () => {
    render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    expect(screen.getByText(/ゼロを下回ると債券の実質利回りが株式の益回りを上回る/)).toBeInTheDocument();
  });

  it('標本不足なら分布を出さない', () => {
    // 誤解を招く数値を出すより、出せないことを伝える。
    render(<YieldSpreadChart view={makeView(null)} />);
    expect(screen.getByText(/過去分布は標本不足で出せない/)).toBeInTheDocument();
    expect(screen.queryByText(/過去 5 年で下位/)).not.toBeInTheDocument();
  });

  it('蓄積中は標本不足の表示を重ねない', () => {
    // 蓄積中である旨は別途出るため、同じことを 2 回言わない (#54)。
    render(<YieldSpreadChart view={makeView(null, { weeks: 1, note: '過去に遡れない。' })} />);
    expect(screen.queryByText(/過去分布は標本不足で出せない/)).not.toBeInTheDocument();
    expect(screen.getByText(/スプレッド は蓄積中/)).toBeInTheDocument();
  });

  it('蓄積中は内訳ボタンを出さない', () => {
    // 図が無いので押しても何も起きない。
    render(<YieldSpreadChart view={makeView(null, { weeks: 1, note: '過去に遡れない。' })} />);
    expect(screen.queryByRole('button', { name: '内訳を表示' })).not.toBeInTheDocument();
  });

  it('通常時は内訳ボタンで系列を切り替えられる', () => {
    render(<YieldSpreadChart view={makeView(DISTRIBUTION)} />);
    const button = screen.getByRole('button', { name: '内訳を表示' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
