import { describe, expect, it } from 'vitest';
import type { ValuationPoint } from '@/lib/data/types';
import { pick } from './summary-bar';

function point(date: string, overrides: Partial<ValuationPoint> = {}): ValuationPoint {
  return {
    date,
    index: null,
    forwardPe: null,
    trailingPe: null,
    forwardEps: null,
    trailingEps: null,
    earningsYield: null,
    realRate: null,
    yieldSpread: null,
    fairValue: null,
    overvaluation: null,
    isForwardEpsHigh: false,
    isTrailingEpsHigh: false,
    ...overrides,
  };
}

describe('pick', () => {
  it('最新値と前週比を返す', () => {
    const points = [
      point('2026-08-07', { forwardPe: 19.6 }),
      point('2026-08-14', { forwardPe: 20.0 }),
    ];
    const result = pick(points, 'forwardPe');
    expect(result.value).toBe(20.0);
    expect(result.delta.value).toBeCloseTo(0.4, 5);
    expect(result.delta.weeksBack).toBe(1);
    expect(result.date).toBe('2026-08-14');
  });

  it('欠測を挟むと「2週前比」になる', () => {
    // FactSet の休刊週が挟まると前週の値が無い。何週前と比べたかを示さないと
    // 変化量を読み違える (plan U-S3)。
    const points = [
      point('2026-08-07', { forwardPe: 19.6 }),
      point('2026-08-14'), // 休刊で欠測
      point('2026-08-21', { forwardPe: 20.0 }),
    ];
    const result = pick(points, 'forwardPe');
    expect(result.delta.weeksBack).toBe(2);
    expect(result.date).toBe('2026-08-21');
  });

  it('欠測が 2 週続けば「3週前比」になる', () => {
    const points = [
      point('2026-08-07', { forwardPe: 19.6 }),
      point('2026-08-14'),
      point('2026-08-21'),
      point('2026-08-28', { forwardPe: 20.0 }),
    ];
    expect(pick(points, 'forwardPe').delta.weeksBack).toBe(3);
  });

  it('値が 1 件しかなければ差分を出さない', () => {
    const result = pick([point('2026-08-07', { index: 7700 })], 'index');
    expect(result.value).toBe(7700);
    expect(result.delta.value).toBeNull();
  });

  it('値が無ければ null を返す', () => {
    const result = pick([point('2026-08-07')], 'index');
    expect(result.value).toBeNull();
    expect(result.date).toBeNull();
  });

  it('負の値の差分でも符号が正しい', () => {
    // イールドスプレッドや割高率は負になりうる。
    const points = [
      point('2026-08-07', { overvaluation: -5.0 }),
      point('2026-08-14', { overvaluation: -2.0 }),
    ];
    expect(pick(points, 'overvaluation').delta.value).toBeCloseTo(3.0, 5);
  });
});
