import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JapanPage from './page';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('日本ページの注記を初心者にも分かるようにする (#314)', () => {
  it('M2の意味を説明する', () => {
    render(<JapanPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('世の中に出回っている通貨の量');
  });

  it('DI (拡散指数) の意味を説明する', () => {
    render(<JapanPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('DI (拡散指数)');
  });

  it('「source」のような英語名詞表現を使わない', () => {
    render(<JapanPage />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('構造的な source');
    expect(text).toContain('構造的な源');
  });

  it('見出し「日本」を出す', () => {
    render(<JapanPage />);
    expect(screen.getByRole('heading', { name: '日本', level: 1 })).toBeInTheDocument();
  });
});

describe('実質GDP成長率 (#336)', () => {
  it('チャートと前期比年率の説明を出す', () => {
    render(<JapanPage />);
    const text = document.body.textContent ?? '';
    expect(
      screen.getByRole('heading', { name: '実質GDP成長率 (日本)', level: 3 }),
    ).toBeInTheDocument();
    expect(text).toContain('その四半期のペースが 1 年続いた場合の伸び率');
  });
});
