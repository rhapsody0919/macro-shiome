import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Period } from './period';
import { useChartPeriod } from './use-chart-period';

describe('useChartPeriod (#299)', () => {
  it('未上書きならグローバルの期間をそのまま返す', () => {
    const { result } = renderHook(() => useChartPeriod('1y'));
    expect(result.current[0]).toBe('1y');
  });

  it('上書きするとその値を返す', () => {
    const { result } = renderHook(() => useChartPeriod('1y'));
    act(() => result.current[1]('5y'));
    expect(result.current[0]).toBe('5y');
  });

  it('上書き後にグローバルが変わっても上書き値を維持する', () => {
    const { result, rerender } = renderHook(({ global }) => useChartPeriod(global), {
      initialProps: { global: '1y' as Period },
    });
    act(() => result.current[1]('all'));
    rerender({ global: '3y' });
    expect(result.current[0]).toBe('all');
  });
});
