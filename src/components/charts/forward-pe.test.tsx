import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForwardPeChart } from './forward-pe';
import { valuationView } from '@/lib/data/loader';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

/**
 * Forward と実績は水準が違う (#116)。切り替えたときに**基準線も一緒に切り替わる**
 * ことが要件。片方だけ切り替わると、違う種類の PER と平均を比べることになる。
 */
describe('P/E と基準線 (#116)', () => {
  const switchTo = (label: string) => {
    act(() => {
      screen.getByRole('button', { name: label }).click();
    });
  };

  it('既定は Forward P/E', () => {
    render(<ForwardPeChart view={valuationView} />);
    expect(screen.getByRole('button', { name: 'Forward' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.body.textContent).toContain('Forward P/E');
  });

  it('実績に切り替えると値と基準線が実績側になる', () => {
    render(<ForwardPeChart view={valuationView} />);
    const forwardText = document.body.textContent ?? '';
    switchTo('実績');
    const trailingText = document.body.textContent ?? '';

    expect(trailingText).toContain('実績 P/E');
    // 実績 P/E は Forward より高い。同じ表示のままなら切り替わっていない。
    expect(trailingText).not.toBe(forwardText);
    expect(
      screen.getByRole('button', { name: '実績' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('定義の違いを注記に出す', () => {
    render(<ForwardPeChart view={valuationView} />);
    expect(document.body.textContent).toContain('Forward と実績は水準が違う');
  });
});
