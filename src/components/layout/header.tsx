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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-tight">macro-shiome</span>
          <nav aria-label="メイン" className="flex">
            <Suspense fallback={<span className="px-3 py-1.5 text-sm">バリュエーション</span>}>
              <NavLink href="/">バリュエーション</NavLink>
            </Suspense>
            <Suspense fallback={<span className="px-3 py-1.5 text-sm">マクロ指標</span>}>
              <NavLink href="/macro">マクロ指標</NavLink>
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
