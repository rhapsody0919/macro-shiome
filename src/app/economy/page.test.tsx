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

describe('JOLTSのレイオフ・解雇 (#335)', () => {
  it('求人件数のチャートにレイオフ・解雇の系列を出す', () => {
    render(<EconomyPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('レイオフ・解雇');
    // 泉さんの記事のフレームワーク (求人とリストラの均衡) を注記で説明する。
    expect(text).toContain('求人とレイオフの均衡');
  });
});

describe('著名投資家が参照する定番指標 (#337)', () => {
  it('サーム・ルール景気後退指標を失業率の直後に表示する', () => {
    render(<EconomyPage />);
    expect(
      screen.getByRole('heading', { name: 'サーム・ルール景気後退指標', level: 3 }),
    ).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('0.5 ポイントを超えると景気後退入りとされる');
  });

  it('トラック輸送量を消費のセクションに表示する', () => {
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: 'トラック輸送量', level: 3 })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('物流量そのもの');
  });

  it('銅価格を原油と別のチャートで表示する', () => {
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '銅価格', level: 3 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '原油価格 (WTI)', level: 3 }),
    ).toBeInTheDocument();
  });
});
