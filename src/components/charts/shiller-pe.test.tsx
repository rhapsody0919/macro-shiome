import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShillerPeChart } from './shiller-pe';
import { valuationView } from '@/lib/data/loader';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('シラーPER (CAPE) (#291)', () => {
  it('最新値と過去分布を出す', () => {
    render(<ShillerPeChart view={valuationView} />);
    expect(screen.getByText('シラーPER (CAPE)')).toBeInTheDocument();
    expect(document.body.textContent).toContain('過去 5 年で下位');
  });

  it('Forward/実績 PER とは定義が違うことを注記に出す', () => {
    render(<ShillerPeChart view={valuationView} />);
    expect(document.body.textContent).toContain('定義が違う');
  });
});
