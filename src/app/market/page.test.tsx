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
