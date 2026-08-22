import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketPage from '@/app/market/page';
import { DrawdownChart } from './drawdown-chart';
import { drawdown } from '@/lib/data/loader';
import { DRAWDOWN_ASSETS, DRAWDOWN_GROUPS } from '@/lib/data/drawdown-assets';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('下落率チャート (#128)', () => {
  it('下落率が大きい順に並べる', () => {
    // 「いま何が売られているか」がそのまま順位として読めることが要件。
    const assets = [
      { id: 'a', name: '小さい', group: 'major', high: 100, latest: { date: '2026-08-14', drawdown: 2 }, points: [] },
      { id: 'b', name: '大きい', group: 'major', high: 100, latest: { date: '2026-08-14', drawdown: 40 }, points: [] },
      { id: 'c', name: '中くらい', group: 'major', high: 100, latest: { date: '2026-08-14', drawdown: 20 }, points: [] },
    ];
    render(
      <DrawdownChart
        title="テスト"
        subtitle="テスト"
        assets={assets}
        colors={{ a: '#000000', b: '#111111', c: '#222222' }}
        notes={[]}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text.indexOf('大きい')).toBeLessThan(text.indexOf('中くらい'));
    expect(text.indexOf('中くらい')).toBeLessThan(text.indexOf('小さい'));
  });

  it('最新値が無い資産は順位に出さない', () => {
    // 取得前の資産を 0% として並べると「最高値圏」と誤読される。
    render(
      <DrawdownChart
        title="テスト"
        subtitle="テスト"
        assets={[{ id: 'x', name: '未取得', group: 'major', high: null, latest: null, points: [] }]}
        colors={{ x: '#000000' }}
        notes={[]}
      />,
    );
    expect(screen.queryByText('未取得')).not.toBeInTheDocument();
  });
});

describe('市場ページへの組み込み (#128)', () => {
  it('4 つの下落率グループとパターン検出 (#230 #231 #256) が問いの中に並ぶ', () => {
    render(<MarketPage />);
    const section = document.getElementById('q-drawdown');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual([
      '主要資産の下落率',
      '米国セクターの下落率',
      'コモディティの下落率',
      '各国の下落率',
      'High Tight Flag (急騰後の保ち合い)',
      'カップウィズハンドル',
      'ダブルボトム',
    ]);
  });

  it('各グループに資産が 1 件以上ある', () => {
    // グループ定義とビューの group がずれると、空のチャートが並ぶ。
    for (const group of Object.keys(DRAWDOWN_GROUPS)) {
      const inView = drawdown.assets.filter((asset) => asset.group === group);
      expect(inView.length, group).toBeGreaterThan(0);
    }
  });

  it('定義した資産はすべてグループのどれかに属する', () => {
    const groups = new Set(Object.keys(DRAWDOWN_GROUPS));
    for (const asset of DRAWDOWN_ASSETS) expect(groups.has(asset.group), asset.id).toBe(true);
  });
});
