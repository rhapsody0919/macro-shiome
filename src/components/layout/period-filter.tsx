'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIOD_LABELS, PERIODS, parsePeriod } from '@/lib/period';

/**
 * 期間フィルター (spec F-6)。
 *
 * 選択は URL クエリに反映する。リロード・画面遷移・共有リンクで状態が飛ばないようにするため。
 * 全画面が同じクエリを見るので、画面をまたいでも選択が揃う。
 */
export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = parsePeriod(searchParams.get('period'));

  function select(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    // 履歴を汚さないよう replace を使う。期間切り替えは「戻る」の対象にしない。
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="期間"
      className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
    >
      {PERIODS.map((period) => {
        const isActive = period === current;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={isActive}
            onClick={() => select(period)}
            className={[
              'px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md',
              'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
              isActive
                ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            {PERIOD_LABELS[period]}
          </button>
        );
      })}
    </div>
  );
}
