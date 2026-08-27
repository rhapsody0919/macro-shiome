import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusPage from './page';

describe('指標の取得状況ページ (#330)', () => {
  it('見出しと頻度タブを出す', () => {
    render(<StatusPage />);
    expect(screen.getByRole('heading', { name: '指標の取得状況', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '頻度' })).toBeInTheDocument();
  });

  it('恣意的な閾値を使わない旨を明記する', () => {
    render(<StatusPage />);
    expect(document.body.textContent).toContain('異常」という判定はしない');
  });

  it('実データを描画してもエラーにならない', () => {
    expect(() => render(<StatusPage />)).not.toThrow();
  });
});
