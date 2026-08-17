import { describe, expect, it } from 'vitest';
import { COLORS } from './colors';

describe('系列色 (#77)', () => {
  it('同じ意味の系列は 1 か所で定義する', () => {
    // 直書きしていたため「実質金利」がマクロ画面とイールドスプレッドで別の色だった。
    expect(COLORS.realRate).toBe('#0ea5e9');
  });

  it('同じチャートに並ぶ金利 3 系列は互いに違う色', () => {
    const rates = [COLORS.nominalRate, COLORS.breakeven, COLORS.realRate];
    expect(new Set(rates).size).toBe(3);
  });

  it('物価の連鎖 4 系列は互いに違う色', () => {
    const prices = [COLORS.importPrice, COLORS.producerPrice, COLORS.cpi, COLORS.pce];
    expect(new Set(prices).size).toBe(4);
  });

  it('労働の 3 系列は互いに違う色', () => {
    const labor = [COLORS.payrolls, COLORS.employmentLevel, COLORS.fullTimeEmployment];
    expect(new Set(labor).size).toBe(3);
  });

  it('住宅の 3 系列は互いに違う色', () => {
    const housing = [COLORS.buildingPermits, COLORS.housingStarts, COLORS.newHomeSales];
    expect(new Set(housing).size).toBe(3);
  });

  it('すべて 6 桁の 16 進数', () => {
    for (const [name, value] of Object.entries(COLORS)) {
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
