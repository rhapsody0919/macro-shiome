import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IndicatorStatusTabs } from './indicator-status-tabs';
import type { IndicatorStatusEntry } from '@/lib/data/types';

const ENTRIES: IndicatorStatusEntry[] = [
  {
    indicatorId: 'a',
    name: '日次指標A',
    frequency: 'daily',
    recentDates: ['2026-08-24', '2026-08-23'],
    gapReason: null,
  },
  {
    indicatorId: 'b',
    name: '週次指標B',
    frequency: 'weekly',
    recentDates: ['2026-08-21'],
    gapReason: null,
  },
  {
    indicatorId: 'c',
    name: '週次指標C (欠測あり)',
    frequency: 'weekly',
    recentDates: ['2026-07-31'],
    gapReason: 'レポートが公開されていない',
  },
];

describe('IndicatorStatusTabs (#330)', () => {
  it('既定は日次タブで、日次の指標だけ出す', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    expect(screen.getByText('日次指標A')).toBeInTheDocument();
    expect(screen.queryByText('週次指標B')).not.toBeInTheDocument();
  });

  it('週次タブに切り替えると週次の指標だけ出る', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    fireEvent.click(screen.getByRole('button', { name: /週次/ }));
    expect(screen.getByText('週次指標B')).toBeInTheDocument();
    expect(screen.getByText('週次指標C (欠測あり)')).toBeInTheDocument();
    expect(screen.queryByText('日次指標A')).not.toBeInTheDocument();
  });

  it('欠測理由がある指標を先頭に出す', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    fireEvent.click(screen.getByRole('button', { name: /週次/ }));
    const names = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(names[0]).toContain('週次指標C');
  });

  it('欠測理由を表示する', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    fireEvent.click(screen.getByRole('button', { name: /週次/ }));
    expect(screen.getByText('レポートが公開されていない')).toBeInTheDocument();
  });

  it('直近の観測日を表示する', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    expect(screen.getByText(/2026\/08\/24/)).toBeInTheDocument();
  });

  it('タブに指標数を表示する', () => {
    render(<IndicatorStatusTabs entries={ENTRIES} />);
    expect(screen.getByRole('button', { name: '日次 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '週次 (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '月次 (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '四半期 (0)' })).toBeInTheDocument();
  });
});
