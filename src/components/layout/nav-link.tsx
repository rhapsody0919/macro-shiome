'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * ナビゲーションのリンク。
 * **期間フィルターのクエリを引き継ぐ**ので、画面を移っても選択が保たれる (spec F-6)。
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = pathname === href;

  const query = searchParams.toString();
  const target = query.length > 0 ? `${href}?${query}` : href;

  return (
    <Link
      href={target}
      aria-current={isActive ? 'page' : undefined}
      className={[
        // 折り返すと単語の途中で切れて読めなくなる (375px で実測)。
        'whitespace-nowrap px-2 py-1.5 text-sm sm:px-3',
        isActive
          ? 'border-b-2 border-slate-900 font-semibold text-slate-900 dark:border-slate-100 dark:text-slate-100'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
