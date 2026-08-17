import { Suspense } from 'react';
import { status, toFreshness } from '@/lib/data/loader';
import { FreshnessBadge } from './freshness-badge';
import { NavLink } from './nav-link';
import { PeriodFilter } from './period-filter';

/**
 * グローバルヘッダー (screens N-1)。
 *
 * 期間フィルターと鮮度表示を置く。
 *
 * `useSearchParams` を使う子は静的生成時に Suspense で包む必要があるため、
 * ここで境界を張る。
 */
export function Header() {
  // ビルド時に評価する。静的エクスポートなので、デプロイ時点の鮮度が表示される。
  const freshness = toFreshness(status, new Date());

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          {/*
            狭い画面ではロゴを隠す。375px だとロゴ + ナビ 3 つが入らず折り返して
            ヘッダーが 2 段になる。ページ名は h1 に出ているので識別できる。
          */}
          <span className="hidden text-sm font-bold tracking-tight whitespace-nowrap sm:inline">
            macro-shiome
          </span>
          <nav aria-label="メイン" className="flex">
            <Suspense fallback={<span className="px-3 py-1.5 text-sm">バリュエーション</span>}>
              <NavLink href="/">バリュエーション</NavLink>
            </Suspense>
            <Suspense fallback={<span className="px-3 py-1.5 text-sm">経済</span>}>
              <NavLink href="/economy">経済</NavLink>
            </Suspense>
            <Suspense fallback={<span className="px-3 py-1.5 text-sm">市場</span>}>
              <NavLink href="/market">市場</NavLink>
            </Suspense>
          </nav>
        </div>

        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-2">
        <FreshnessBadge freshness={freshness} />
      </div>
    </header>
  );
}
