import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EconomyPage from './page';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('経済ページの注記を初心者にも分かるようにする (#312)', () => {
  it('季節調整済みの意味を説明する', () => {
    render(<EconomyPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('季節調整済み」とは');
  });

  it('CPI/PCEの正式名称と違いを説明する', () => {
    render(<EconomyPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('消費者物価指数');
    expect(text).toContain('個人消費支出物価指数');
  });

  it('見出し「経済」を出す', () => {
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '経済', level: 1 })).toBeInTheDocument();
  });
});
