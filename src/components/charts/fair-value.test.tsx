import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ValuationView } from '@/lib/data/types';
import { valuationPoint, valuationSeries } from '@/test/fixtures';
import { FairValueChart } from './fair-value';

// 期間フィルターは URL 由来。テストでは既定 (全期間) 相当を返す。
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const NOTE = '提供元が現在値しか出さないため過去に遡れない。';

/** 理論値を `weeks` 週ぶん持つ系列。 */
function series(weeks: number, note: string | null) {
  const points = Array.from({ length: weeks }, (_, i) =>
    valuationPoint(`2026-01-${String(i + 1).padStart(2, '0')}`, {
      index: 6800,
      trailingEps: 273.4,
      fairValue: 7449.6,
      overvaluation: 3.97,
    }),
  );
  return valuationSeries(points, { accumulationNote: note });
}

/** S&P 500 は常に十分な履歴を持たせ、NASDAQ-100 側だけを変える。 */
function makeView(nasdaqWeeks: number): ValuationView {
  return {
    sp500: series(20, null),
    nasdaq100: { ...series(nasdaqWeeks, NOTE), hasForwardEps: false },
    shillerPe: { points: [], distribution: null },
  };
}

function selectNasdaq() {
  fireEvent.click(screen.getByRole('button', { name: 'NASDAQ-100' }));
}

describe('理論値と割高率', () => {
  it('蓄積が足りない指数では図の代わりに状態と理由を出す', () => {
    // NASDAQ-100 の実績 PER は過去に遡れず、2026-08 時点で 1 週分しか無い (#54)。
    render(<FairValueChart view={makeView(1)} />);
    selectNasdaq();

    expect(screen.getByText(/理論値 は蓄積中/)).toBeInTheDocument();
    // 恒久的な制約ではなく時間で解消することが読み取れる。
    expect(screen.getByText(new RegExp(NOTE))).toBeInTheDocument();
    // 1 点でも最新の割高率は出す。図が描けないことと値が無いことは別。
    expect(screen.getByText('+3.97%')).toBeInTheDocument();
  });

  it('蓄積が足りていれば通常どおり図を出す', () => {
    render(<FairValueChart view={makeView(20)} />);
    selectNasdaq();
    expect(screen.queryByText(/蓄積中/)).not.toBeInTheDocument();
  });

  it('S&P 500 では蓄積中と表示しない', () => {
    render(<FairValueChart view={makeView(1)} />);
    expect(screen.queryByText(/蓄積中/)).not.toBeInTheDocument();
  });
});
