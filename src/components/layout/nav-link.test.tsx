import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavLink } from './nav-link';

let path = '/';
let query = '';

vi.mock('next/navigation', () => ({
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(query),
}));

describe('NavLink (#245)', () => {
  it('現在地のリンクを aria-current="page" にする', () => {
    path = '/economy';
    query = '';
    render(<NavLink href="/economy">経済</NavLink>);
    expect(screen.getByRole('link', { name: '経済' })).toHaveAttribute('aria-current', 'page');
  });

  it('静的エクスポート本番ビルド (末尾スラッシュ付き) でも現在地と判定する', () => {
    // trailingSlash: true の本番ビルドでは usePathname() が `/economy/` を返す (#245)。
    // 開発サーバー相当の値だけでテストすると本番の不一致を見逃す。
    path = '/economy/';
    query = '';
    render(<NavLink href="/economy">経済</NavLink>);
    expect(screen.getByRole('link', { name: '経済' })).toHaveAttribute('aria-current', 'page');
  });

  it('別ページでは aria-current を付けない', () => {
    path = '/market';
    query = '';
    render(<NavLink href="/economy">経済</NavLink>);
    expect(screen.getByRole('link', { name: '経済' })).not.toHaveAttribute('aria-current');
  });

  it('期間フィルターのクエリを引き継ぐ (spec F-6)', () => {
    path = '/';
    query = 'period=5y';
    render(<NavLink href="/economy">経済</NavLink>);
    expect(screen.getByRole('link', { name: '経済' })).toHaveAttribute(
      'href',
      '/economy?period=5y',
    );
  });
});
