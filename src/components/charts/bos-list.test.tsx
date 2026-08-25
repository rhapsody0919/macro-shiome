import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { BosList } from './bos-list';
import type { BosAsset } from '@/lib/data/types';

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

const DETECTED: BosAsset = {
  symbol: 'SPY',
  name: 'S&P 500 (SPY)',
  detection: {
    firstLowDate: '2026-06-26',
    firstLowPrice: 716.58,
    priorHighDate: '2026-07-15',
    priorHighPrice: 755.58,
    secondLowDate: '2026-07-29',
    secondLowPrice: 729.1,
    breakoutDate: '2026-08-03',
    breakoutPrice: 757.67,
    swingLength: 8,
  },
  priceSeries: [
    { date: '2026-06-26', close: 716.58 },
    { date: '2026-08-03', close: 757.67 },
  ],
};

describe('BosList の折りたたみ表示 (#302)', () => {
  it('銘柄名は常時表示し、詳細 (スイング点) は折りたたむ', () => {
    render(<BosList title="BOS (トレンド継続)" subtitle="" assets={[DETECTED]} notes={[]} />);
    expect(screen.getByText('S&P 500 (SPY)')).toBeInTheDocument();
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    // PatternChart のマーカーラベルにも同じ文言が出るため getAllByText で確認する。
    expect(screen.getAllByText(/1つ目の安値/).length).toBeGreaterThan(0);
  });

  it('0件のときはテキストのみで折りたたみを出さない', () => {
    const notDetected: BosAsset = { ...DETECTED, detection: null, priceSeries: null };
    render(<BosList title="BOS (トレンド継続)" subtitle="" assets={[notDetected]} notes={[]} />);
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getByText(/該当する銘柄はありません/)).toBeInTheDocument();
  });
});
