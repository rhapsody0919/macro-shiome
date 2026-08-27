'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/format';
import type { Frequency, IndicatorStatusEntry } from '@/lib/data/types';

const FREQUENCIES: Array<{ key: Frequency; label: string }> = [
  { key: 'daily', label: '日次' },
  { key: 'weekly', label: '週次' },
  { key: 'monthly', label: '月次' },
  { key: 'quarterly', label: '四半期' },
];

/**
 * 指標ごとの取得状況をタブで見せる (#330)。
 *
 * **閾値による自動判定はしない** (#52 と同じ判断)。直近の観測日をそのまま並べ、
 * 間隔が普段と違うかを読み手が判断する。gaps.json にある明示的な理由だけは表示する。
 */
export function IndicatorStatusTabs({ entries }: { entries: IndicatorStatusEntry[] }) {
  const [frequency, setFrequency] = useState<Frequency>('daily');

  const countByFrequency = Object.fromEntries(
    FREQUENCIES.map(({ key }) => [key, entries.filter((e) => e.frequency === key).length]),
  ) as Record<Frequency, number>;
  const inTab = entries.filter((entry) => entry.frequency === frequency);
  // 理由がある指標を先に出す。見るべきものから目に入るようにするため。
  const sorted = [...inTab].sort((a, b) => {
    if ((a.gapReason !== null) === (b.gapReason !== null)) {
      return a.name.localeCompare(b.name, 'ja');
    }
    return a.gapReason !== null ? -1 : 1;
  });
  const gapCount = inTab.filter((entry) => entry.gapReason !== null).length;

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="頻度"
        className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
      >
        {FREQUENCIES.map((item) => {
          const isActive = item.key === frequency;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFrequency(item.key)}
              className={[
                'px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md',
                'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
                isActive
                  ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {item.label} ({countByFrequency[item.key]})
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">
        {gapCount === 0
          ? 'この頻度で、現時点で欠測の理由が記録されている指標は無い。'
          : `${gapCount}件に欠測の理由が記録されている (下の一覧の先頭)。`}
      </p>

      <ul className="space-y-2">
        {sorted.map((entry) => (
          <li
            key={entry.indicatorId}
            className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{entry.name}</span>
              {entry.gapReason !== null && (
                <span className="text-xs text-amber-600 dark:text-amber-400">{entry.gapReason}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {entry.recentDates.length === 0
                ? '観測が無い。'
                : `直近の観測日: ${entry.recentDates.map((d) => formatDate(d)).join(' → ')}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
