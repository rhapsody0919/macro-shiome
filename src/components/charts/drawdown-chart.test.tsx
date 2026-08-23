import { act, render, screen } from '@testing-library/react';
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
      {
        id: 'a', name: '小さい', group: 'major', high: 100,
        latest: { date: '2026-08-14', drawdown: 2 }, points: [],
        latestRelativeStrength: null, relativeStrengthPoints: [],
      },
      {
        id: 'b', name: '大きい', group: 'major', high: 100,
        latest: { date: '2026-08-14', drawdown: 40 }, points: [],
        latestRelativeStrength: null, relativeStrengthPoints: [],
      },
      {
        id: 'c', name: '中くらい', group: 'major', high: 100,
        latest: { date: '2026-08-14', drawdown: 20 }, points: [],
        latestRelativeStrength: null, relativeStrengthPoints: [],
      },
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

  it('対SPYに切り替えると相対強度順に並び替わる (#274)', () => {
    const assets = [
      {
        id: 'a', name: '弱い', group: 'major', high: 100,
        latest: { date: '2026-08-14', drawdown: 10 }, points: [],
        latestRelativeStrength: { date: '2026-08-14', value: -5 },
        relativeStrengthPoints: [],
      },
      {
        id: 'b', name: '強い', group: 'major', high: 100,
        latest: { date: '2026-08-14', drawdown: 10 }, points: [],
        latestRelativeStrength: { date: '2026-08-14', value: 8 },
        relativeStrengthPoints: [],
      },
    ];
    render(
      <DrawdownChart
        title="テスト"
        subtitle="テスト"
        assets={assets}
        colors={{ a: '#000000', b: '#111111' }}
        notes={[]}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: '対SPY' }).click();
    });
    const text = document.body.textContent ?? '';
    expect(text.indexOf('強い')).toBeLessThan(text.indexOf('弱い'));
    expect(text).toContain('+8.0%');
    expect(text).toContain('-5.0%');
  });

  it('最新値が無い資産は順位に出さない', () => {
    // 取得前の資産を 0% として並べると「最高値圏」と誤読される。
    render(
      <DrawdownChart
        title="テスト"
        subtitle="テスト"
        assets={[
          {
            id: 'x', name: '未取得', group: 'major', high: null, latest: null, points: [],
            latestRelativeStrength: null, relativeStrengthPoints: [],
          },
        ]}
        colors={{ x: '#000000' }}
        notes={[]}
      />,
    );
    expect(screen.queryByText('未取得')).not.toBeInTheDocument();
  });
});

describe('市場ページへの組み込み (#128)', () => {
  it('4 つの下落率グループとブレイクアウト検出 (#268 #272) が問いの中に並ぶ', () => {
    render(<MarketPage />);
    const section = document.getElementById('q-drawdown');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual([
      '主要資産の下落率',
      '米国セクターの下落率',
      'コモディティの下落率',
      '各国の下落率',
      'ブレイクアウト (CHoCH)',
      'BOS (トレンド継続)',
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
