import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CorrelationSummary } from './correlation-summary';
import { valuationView } from '@/lib/data/loader';

describe('ピアソン相関係数・標本の平易な言い換え (#311)', () => {
  it('ピアソン相関係数を平易に説明する', () => {
    render(<CorrelationSummary view={valuationView} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('どれくらい同じ方向に動くか');
  });

  it('nを標本数として説明する', () => {
    render(<CorrelationSummary view={valuationView} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('「n =」は集計に使った週の数');
  });
});
