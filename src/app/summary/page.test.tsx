import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummaryPage from './page';

describe('AI要約ページ (#279)', () => {
  it('3つの問いを見出しとして出す', () => {
    render(<SummaryPage />);
    expect(screen.getByRole('heading', { name: '経済はどのような状態か' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '注意が必要なことはあるか' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '狙い目なセクター/ETFはあるか' }),
    ).toBeInTheDocument();
  });

  it('実データを描画してもエラーにならない (loader経由のsummary.jsonをそのまま使う)', () => {
    // 現状の summary.json は経済状態未生成 (null) の状態。null 表示のフォールバックを
    // 実データで確認する。警告・ハイライトの有無は日次バッチで変わるため、
    // 個数や具体的な値はここでは固定しない (drawdown-chart.test.tsx と同じ方針)。
    expect(() => render(<SummaryPage />)).not.toThrow();
  });
});
