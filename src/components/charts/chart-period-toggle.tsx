'use client';

import { PERIOD_LABELS, PERIODS, type Period } from '@/lib/period';

/**
 * チャート単位の期間切替 (#299)。
 *
 * `PeriodFilter` (ヘッダーのグローバル切替) の小型版。`ChartFrame` の `actions`
 * スロットに置き、既存のモード切替 (下落率/対SPY 等) と横並びで共存させる。
 */
export function ChartPeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div
      role="group"
      aria-label="この図の期間"
      className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
    >
      {PERIODS.map((p) => {
        const isActive = p === period;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(p)}
            className={[
              'px-2 py-1 text-[11px] first:rounded-l-md last:rounded-r-md',
              'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
              isActive
                ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
