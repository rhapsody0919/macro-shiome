import { render } from '@testing-library/react';
import { describe, expect, it, beforeAll } from 'vitest';
import { PatternChart } from './pattern-chart';

/**
 * jsdom には ResizeObserver が無く、Recharts の `ResponsiveContainer` はこれが無いと
 * 子を描画しない。テストのためだけに固定サイズを返すモックを用意する
 * (#260 のセッションで判明した既知の制約への対処)。
 */
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

describe('PatternChart の Y 軸範囲 (#272)', () => {
  it('マーカーの価格が終値の範囲より低くても描画する', () => {
    // #272 で発覚: マーカーは高値・安値、折れ線は終値のみを使うため、
    // domain=['auto','auto'] (終値だけを見て決まる) だとマーカーが範囲外になり
    // Recharts がサイレントに描画しない事例があった (実データの SPY/VTI/VNQ)。
    const priceSeries = [
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: 105 },
      { date: '2026-01-03', close: 110 },
    ];
    const { container } = render(
      <PatternChart
        priceSeries={priceSeries}
        markers={[
          // 終値のどれよりも低い安値 (実データと同じ「high/low が close の範囲外」の形)。
          { date: '2026-01-01', price: 80, label: '安値' },
          { date: '2026-01-03', price: 110, label: '高値' },
        ]}
      />,
    );
    expect(container.querySelectorAll('.recharts-reference-dot')).toHaveLength(2);
  });

  it('水準線 (levels) が終値の範囲より高くても描画する', () => {
    const priceSeries = [
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: 105 },
    ];
    const { container } = render(
      <PatternChart
        priceSeries={priceSeries}
        markers={[]}
        levels={[{ value: 200, label: '上抜けた水準' }]}
      />,
    );
    expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(1);
  });
});
