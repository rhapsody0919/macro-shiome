import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeriodFilter } from './period-filter';

const replace = vi.fn();
let query = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(query),
}));

describe('PeriodFilter', () => {
  it('4 つの期間を表示する', () => {
    query = '';
    render(<PeriodFilter />);
    for (const label of ['1年', '3年', '5年', '全期間']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('URL の期間を選択状態にする', () => {
    // リロード・共有リンクで選択が復元されることの担保 (spec F-6)。
    query = 'period=5y';
    render(<PeriodFilter />);
    expect(screen.getByRole('button', { name: '5年' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1年' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('未知の期間は既定値にフォールバックする', () => {
    query = 'period=99y';
    render(<PeriodFilter />);
    expect(screen.getByRole('button', { name: '1年' })).toHaveAttribute('aria-pressed', 'true');
  });
});
