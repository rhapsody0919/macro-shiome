import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EconomyPage from '@/app/economy/page';
import MarketPage from '@/app/market/page';
import { ECONOMY_QUESTIONS, MARKET_QUESTIONS } from '@/lib/questions';
import { Badges } from './badges';

// チャートは期間フィルター (URL) を読む。ページ全体を描くのでここで差し替える。
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

/**
 * 実画面の確認はブラウザ pane では取れない (`document.hidden: true` で
 * React が画面下部のハイドレーションを遅らせ、Recharts が描画されない)。
 * 代わりにここで構造を検証する。
 */

describe('問いによる画面構成 (#89)', () => {
  it('経済ページは 5 つの問いをすべて見出しに出す', () => {
    render(<EconomyPage />);
    for (const question of Object.values(ECONOMY_QUESTIONS)) {
      // 目次リンクと見出しの 2 か所に出るため、見出しに限って探す。
      expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    }
  });

  it('市場ページは 2 つの問いをすべて見出しに出す', () => {
    render(<MarketPage />);
    for (const question of Object.values(MARKET_QUESTIONS)) {
      expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    }
  });

  it('目次から各問いへ飛べる', () => {
    // 問いが 5 つ並ぶとモバイルでは全体像が見えないため、先頭に目次を置いている。
    render(<EconomyPage />);
    const index = screen.getByRole('navigation', { name: 'このページで答える問い' });
    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(Object.keys(ECONOMY_QUESTIONS).length);
    // href の先が実在しないと目次が機能しない。
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('週次と月次が同じ問いに混ざる場合も頻度が判別できる', () => {
    // 更新頻度でページを分けた #64 の判断を撤回したため、バッジが唯一の手がかりになる。
    render(<EconomyPage />);
    expect(screen.getAllByText('週次').length).toBeGreaterThan(0);
    expect(screen.getAllByText('月次').length).toBeGreaterThan(0);
  });
});

describe('チャートのバッジ', () => {
  it('景気サイクルの分類が無ければ頻度だけ出す', () => {
    // 分類の無い指標に分類を付けない (#62)。
    render(<Badges frequency="weekly" />);
    expect(screen.getByText('週次')).toBeInTheDocument();
    expect(screen.queryByText('先行')).not.toBeInTheDocument();
  });

  it('分類があれば説明付きで出す', () => {
    render(<Badges frequency="monthly" cyclePosition="leading" />);
    expect(screen.getByText('月次')).toBeInTheDocument();
    expect(screen.getByText('先行')).toHaveAttribute('title', expect.stringContaining('先立って'));
  });
});
