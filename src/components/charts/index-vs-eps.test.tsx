import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexVsEpsChart } from './index-vs-eps';
import { valuationView } from '@/lib/data/loader';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

describe('GAAP/operatingベースの平易な言い換え (#311)', () => {
  it('GAAPとoperatingベースの違いを平易に説明する', () => {
    render(<IndexVsEpsChart view={valuationView} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('会計基準どおりの利益');
    expect(text).toContain('本業の利益だけを取り出したもの');
  });
});
