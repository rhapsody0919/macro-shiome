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

describe('GAAP/operatingベースの平易な言い換え (#311)', () => {
  it('GAAPとoperatingベースの違いを平易に説明する', () => {
    render(<ForwardPeChart view={valuationView} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('会計基準どおりに算出した利益');
    expect(text).toContain('本業の利益だけを取り出したもの');
  });
});

describe('PER の過去分布 (#271)', () => {
  it('Forward P/E の過去分布を出す', () => {
    render(<ForwardPeChart view={valuationView} />);
    expect(document.body.textContent).toContain('過去 5 年で下位');
  });

  it('実績に切り替えると分布も切り替わる', () => {
    render(<ForwardPeChart view={valuationView} />);
    const forwardText = document.body.textContent ?? '';
    act(() => {
      screen.getByRole('button', { name: '実績' }).click();
    });
    const trailingText = document.body.textContent ?? '';
    expect(trailingText).not.toBe(forwardText);
    expect(trailingText).toContain('過去 5 年で下位');
  });
});
