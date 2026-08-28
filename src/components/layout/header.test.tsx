import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('ヘッダーの取得状況リンク (#332)', () => {
  it('/status へのリンクを常時表示する', () => {
    render(<Header />);
    const link = screen.getByRole('link', { name: '取得状況' });
    expect(link).toHaveAttribute('href', '/status');
  });
});
