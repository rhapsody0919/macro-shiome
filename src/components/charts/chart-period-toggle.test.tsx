import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartPeriodToggle } from './chart-period-toggle';

describe('ChartPeriodToggle (#299)', () => {
  it('4 つの期間を表示し、現在値を選択状態にする', () => {
    render(<ChartPeriodToggle period="5y" onChange={vi.fn()} />);
    for (const label of ['1年', '3年', '5年', '全期間']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '5年' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1年' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('クリックで onChange を呼ぶ', () => {
    const onChange = vi.fn();
    render(<ChartPeriodToggle period="1y" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '全期間' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
