import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TermsPage from './page';

describe('利用規約ページの更新頻度の記述 (#308)', () => {
  it('日次バッチ (#136) と一致する記述にする', () => {
    render(<TermsPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('データは毎日');
    expect(text).not.toContain('毎週土曜日');
  });

  it('見出し「利用規約・データの出所」を出す', () => {
    render(<TermsPage />);
    expect(
      screen.getByRole('heading', { name: '利用規約・データの出所', level: 1 }),
    ).toBeInTheDocument();
  });
});

describe('日銀APIのクレジット表示 (#228 #338、ADR-0012)', () => {
  it('留意点が定める文言をそのまま表示する', () => {
    render(<TermsPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('このサービスは、日本銀行時系列統計データ検索サイトの API 機能を使用しています。');
    expect(text).toContain('サービスの内容は日本銀行によって保証されたものではありません。');
  });
});
