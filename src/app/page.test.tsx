import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ValuationPage from './page';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('バリュエーションページの導入文 (#301)', () => {
  it('アプリの目的とページ構成を説明する導入文を出す', () => {
    render(<ValuationPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('株式投資の判断に使う指標をまとめたサイト');
  });

  it('AI要約ページへのリンクを出す', () => {
    render(<ValuationPage />);
    const link = screen.getByRole('link', { name: 'AI要約' });
    expect(link).toHaveAttribute('href', '/summary');
  });
});
