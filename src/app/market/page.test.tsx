import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketPage from './page';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('市場ページの注記を初心者にも分かるようにする (#313)', () => {
  it('TIPSの意味を説明する', () => {
    render(<MarketPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('物価連動国債');
  });

  it('VIXの意味を説明する', () => {
    render(<MarketPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('恐怖指数');
  });

  it('「price される」のような英語動詞表現を使わない', () => {
    render(<MarketPage />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('price される');
    expect(text).toContain('織り込まれる');
  });

  it('見出し「市場」を出す', () => {
    render(<MarketPage />);
    expect(screen.getByRole('heading', { name: '市場', level: 1 })).toBeInTheDocument();
  });
});

describe('著名投資家が参照する定番指標 (#337)', () => {
  it('マネーストックM2をFRBバランスシートの直後に表示する', () => {
    render(<MarketPage />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const balanceSheetIndex = titles.indexOf('FRB バランスシート');
    const m2Index = titles.indexOf('マネーストック M2 (米国)');
    expect(balanceSheetIndex).toBeGreaterThanOrEqual(0);
    expect(m2Index).toBe(balanceSheetIndex + 1);
    const text = document.body.textContent ?? '';
    expect(text).toContain('米国側にはこの指標が無かった');
  });
});
