import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YieldSpreadChart } from './yield-spread';
import { valuationView } from '@/lib/data/loader';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

/**
 * 益回りの定義は指数によって違う (#109)。
 *
 * S&P 500 は予想 PER、NASDAQ-100 は予想 PER が取れないため実績 PER。
 * 無条件に「Forward P/E」と書くと、NASDAQ-100 表示中に**画面の説明と値が食い違う**。
 */
describe('イールドスプレッドの益回りの定義 (#109)', () => {
  it('S&P 500 では Forward P/E と書く', () => {
    render(<YieldSpreadChart view={valuationView} />);
    const body = document.body.textContent ?? '';
    expect(body).toContain('1 ÷ Forward P/E');
    expect(body).not.toContain('1 ÷ 実績 P/E');
  });

  it('NASDAQ-100 では実績 P/E と書き、Forward P/E とは書かない', () => {
    render(<YieldSpreadChart view={valuationView} />);
    act(() => {
      screen.getByRole('button', { name: 'NASDAQ-100' }).click();
    });
    const body = document.body.textContent ?? '';
    expect(body).toContain('1 ÷ 実績 P/E');
    expect(body).not.toContain('1 ÷ Forward P/E');
  });

  it('NASDAQ-100 では定義が違う旨も併せて出す', () => {
    render(<YieldSpreadChart view={valuationView} />);
    act(() => {
      screen.getByRole('button', { name: 'NASDAQ-100' }).click();
    });
    expect(document.body.textContent).toContain('S&P 500 とは益回りの定義が違う');
  });
});
