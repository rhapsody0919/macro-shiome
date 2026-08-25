import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JapanPage from '@/app/japan/page';
import { JAPAN_QUESTIONS } from '@/lib/questions';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

/**
 * 日本ページの要約 (#186)。
 *
 * #152 で作ったときはチャート 4 枚で「同じ数字を 2 回出すだけ」として置かなかったが、
 * 17 枚に増えて開いた時点では何も分からない状態になったため追加した。
 */
describe('日本ページの要約 (#186)', () => {
  it('問いの数だけカードを出す', () => {
    // 問いごとに 1 指標 (#89)。問いが増えたらカードも増やす。
    // カードのラベルは見出しではない (#77 の階層を崩さないため) ので注記で数える。
    render(<JapanPage />);
    const summary = screen.getByRole('region', { name: '最新の状況' });
    const notes = within(summary).getAllByText(/。/);
    // 各カードに「問い。補足」形式の注記が 1 つずつ付く。
    const cards = notes.filter((n) => /か。/.test(n.textContent ?? ''));
    expect(cards).toHaveLength(Object.keys(JAPAN_QUESTIONS).length);
  });

  it('カードごとに時点を出す', () => {
    // 日経平均は日次、他は月次。月次でも発表ラグが違う (#64)。
    // 揃っているように見せると、古い値を最新と誤認する。
    render(<JapanPage />);
    const summary = screen.getByRole('region', { name: '最新の状況' });
    // 年月 (2026年6月) と日付 (2026/08/19) の両方が出る。
    expect(within(summary).getAllByText(/2026年\d+月/).length).toBeGreaterThan(0);
    expect(within(summary).getAllByText(/2026\/\d{2}\/\d{2}/).length).toBeGreaterThan(0);
  });

  it('日経平均は前日比で出す', () => {
    // 唯一の日次カード。月次と同じ「前月比」と書くと変化の幅を誤読する。
    render(<JapanPage />);
    const summary = screen.getByRole('region', { name: '最新の状況' });
    expect(within(summary).getAllByText(/前日比|日前比/).length).toBeGreaterThan(0);
  });

  it('経常収支・新設住宅着工戸数は単位を数値の近くに表示する (#306)', () => {
    render(<JapanPage />);
    const summary = screen.getByRole('region', { name: '最新の状況' });
    expect(within(summary).getByText('億円')).toBeInTheDocument();
    expect(within(summary).getByText('戸')).toBeInTheDocument();
  });
});
