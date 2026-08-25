import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MacroChart } from './macro-chart';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

const OLD_POINT = { date: '2015-06-15', vix: 20 };

describe('MacroChart のチャート単位の期間上書き (#299)', () => {
  it('グローバルの期間 (既定 1年) の外側にある点は表示しない', () => {
    render(
      <MacroChart
        points={[OLD_POINT]}
        title="VIX"
        series={[{ key: 'vix', label: 'VIX', color: '#000' }]}
        changeLabel="前日比"
        notes={[]}
      />,
    );
    expect(document.body.textContent).not.toContain('2015/06/15');
  });

  it('チャート単位で「全期間」を選ぶと、グローバルの期間を上書きして表示する', () => {
    render(
      <MacroChart
        points={[OLD_POINT]}
        title="VIX"
        series={[{ key: 'vix', label: 'VIX', color: '#000' }]}
        changeLabel="前日比"
        notes={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '全期間' }));
    expect(document.body.textContent).toContain('2015/06/15');
  });
});
