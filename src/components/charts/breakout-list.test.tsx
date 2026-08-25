import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { BreakoutList } from './breakout-list';
import type { BreakoutAsset } from '@/lib/data/types';

// jsdom には ResizeObserver が無く、PatternChart (Recharts) がこれが無いと描画しない (#260)。
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    private readonly cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [{ target, contentRect: { width: 600, height: 300 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  };
});

const DETECTED: BreakoutAsset = {
  symbol: 'GDX',
  name: '金鉱株 (GDX)',
  detection: {
    firstLowDate: '2026-06-24',
    firstLowPrice: 73.7,
    priorHighDate: '2026-07-06',
    priorHighPrice: 80.18,
    secondLowDate: '2026-07-17',
    secondLowPrice: 69.74,
    breakoutDate: '2026-08-05',
    breakoutPrice: 83.68,
    swingLength: 8,
  },
  priceSeries: [
    { date: '2026-06-24', close: 73.7 },
    { date: '2026-08-05', close: 83.68 },
  ],
};

describe('BreakoutList の折りたたみ表示 (#302)', () => {
  it('銘柄名は常時表示し、詳細 (スイング点) は折りたたむ', () => {
    render(<BreakoutList title="ブレイクアウト (CHoCH)" subtitle="" assets={[DETECTED]} notes={[]} />);
    expect(screen.getByText('金鉱株 (GDX)')).toBeInTheDocument();
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    // 折りたたまれていても DOM 上には存在する (検索・スクリーンリーダーで見つかる)。
    // PatternChart のマーカーラベルにも同じ文言が出るため getAllByText で確認する。
    expect(screen.getAllByText(/1つ目の安値/).length).toBeGreaterThan(0);
  });

  it('0件のときはテキストのみで折りたたみを出さない', () => {
    const notDetected: BreakoutAsset = { ...DETECTED, detection: null, priceSeries: null };
    render(
      <BreakoutList title="ブレイクアウト (CHoCH)" subtitle="" assets={[notDetected]} notes={[]} />,
    );
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getByText(/該当する銘柄はありません/)).toBeInTheDocument();
  });
});
