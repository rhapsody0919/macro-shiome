import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SummaryPage from './page';
import { summary } from '@/lib/data/loader';

describe('AI要約ページ (#279)', () => {
  it('3つの問いを見出しとして出す', () => {
    render(<SummaryPage />);
    expect(screen.getByRole('heading', { name: '経済はどのような状態か' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /注意が必要なことはあるか/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /狙い目なセクター\/ETFはあるか/ }),
    ).toBeInTheDocument();
  });

  it('実データを描画してもエラーにならない (loader経由のsummary.jsonをそのまま使う)', () => {
    // 現状の summary.json は経済状態未生成 (null) の状態。null 表示のフォールバックを
    // 実データで確認する。警告・ハイライトの有無は日次バッチで変わるため、
    // 個数や具体的な値はここでは固定しない (drawdown-chart.test.tsx と同じ方針)。
    expect(() => render(<SummaryPage />)).not.toThrow();
  });
});

describe('初見の分かりやすさの改善 (#283)', () => {
  it('警告・ハイライトの件数を実データと一致するバッジで出す', () => {
    render(<SummaryPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain(`${summary.warnings.length}件`);
    expect(text).toContain(`${summary.highlights.length}件`);
  });

  it('ハイライトには「下落率が深い」チップが常に付く (detectHighlightsの必須条件)', () => {
    render(<SummaryPage />);
    if (summary.highlights.length > 0) {
      const chips = screen.getAllByText('下落率が深い');
      expect(chips).toHaveLength(summary.highlights.length);
    }
  });

  it('SPYの用語説明を含む', () => {
    render(<SummaryPage />);
    expect(screen.getByText(/S&P 500 に連動するETF/)).toBeInTheDocument();
  });

  it('パーセンタイルの用語説明を含む (#304)', () => {
    render(<SummaryPage />);
    expect(screen.getByText(/直近5年間の観測の中で今の値がどの位置にあるか/)).toBeInTheDocument();
  });

  it('ブレイクアウト検出の用語説明を含む (#304)', () => {
    render(<SummaryPage />);
    expect(
      screen.getByText(/終値が前回の高値を上抜けたことを\s*示す/),
    ).toBeInTheDocument();
  });

  it('経済状態が生成済みなら材料件数を注記する', () => {
    render(<SummaryPage />);
    if (summary.economyState !== null) {
      expect(screen.getByText(new RegExp(`${summary.economyStateFactCount}件の指標を材料`))).toBeInTheDocument();
    }
  });
});
