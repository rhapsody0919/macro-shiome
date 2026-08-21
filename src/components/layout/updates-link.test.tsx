import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatesLink } from './updates-link';

let path = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => path,
}));

const LAST_SEEN_KEY = 'macro-shiome:changelog:lastSeen';

describe('UpdatesLink (#243)', () => {
  beforeEach(() => {
    path = '/';
    window.localStorage.clear();
  });

  it('初回訪問 (localStorage 未設定) は未読として扱う', () => {
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.getByLabelText('未読の更新があります')).toBeInTheDocument();
  });

  it('既読日が最新より新しければバッジを出さない', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '2026-08-22');
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.queryByLabelText('未読の更新があります')).not.toBeInTheDocument();
  });

  it('既読日が最新より古ければバッジを出す', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '2026-08-01');
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.getByLabelText('未読の更新があります')).toBeInTheDocument();
  });

  it('/updates を表示中はバッジを出さず、既読を記録する', () => {
    path = '/updates';
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.queryByLabelText('未読の更新があります')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2026-08-21');
  });

  it('静的エクスポート (末尾スラッシュ付き /updates/) でも既読になる', () => {
    // trailingSlash: true の本番ビルドでは usePathname() が末尾スラッシュ付きを返す。
    // 開発サーバーの値だけでテストすると本番の不一致を見逃す。
    path = '/updates/';
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.queryByLabelText('未読の更新があります')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2026-08-21');
  });

  it('更新履歴が無い (undefined) 場合はバッジを出さない', () => {
    render(<UpdatesLink latestDate={undefined} />);
    expect(screen.queryByLabelText('未読の更新があります')).not.toBeInTheDocument();
  });

  it('リンク先は /updates', () => {
    render(<UpdatesLink latestDate="2026-08-21" />);
    expect(screen.getByRole('link', { name: /更新履歴/ })).toHaveAttribute('href', '/updates');
  });
});
