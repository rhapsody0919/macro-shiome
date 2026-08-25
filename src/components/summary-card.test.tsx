import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCard } from './summary-card';

describe('SummaryCard の単位表示 (#306)', () => {
  it('valueUnit を数値のすぐ近くに表示する', () => {
    render(
      <SummaryCard label="経常収支" value="13,969" valueUnit="億円" delta={100} deltaLabel="前月比" />,
    );
    expect(screen.getByText('13,969')).toBeInTheDocument();
    expect(screen.getByText('億円')).toBeInTheDocument();
  });

  it('valueUnit を渡さなければ何も表示しない', () => {
    render(<SummaryCard label="VIX" value="16.0" delta={1.76} deltaLabel="前週比" />);
    expect(screen.getByText('16.0')).toBeInTheDocument();
    expect(screen.queryByText('億円')).not.toBeInTheDocument();
  });
});
