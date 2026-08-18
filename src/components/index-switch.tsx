'use client';

import { INDEX_KEYS, INDEX_LABELS } from '@/lib/data/indices';
import type { IndexKey } from '@/lib/data/types';

/**
 * 指数の切り替え (#58)。
 *
 * バリュエーション画面の 5 か所 (サマリーバー・相関サマリー・指数 vs EPS・
 * イールドスプレッド・理論値) が**同一の見た目とマークアップ**を複製していたため
 * 1 つにまとめた。選択肢は `INDEX_LABELS` から引くので、指数を足しても
 * ここは変更不要。
 */
export function IndexSwitch({
  value,
  onChange,
}: {
  value: IndexKey;
  onChange: (key: IndexKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="指数"
      className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
    >
      {INDEX_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === value}
          onClick={() => onChange(key)}
          className={[
            'px-3 py-1 text-xs first:rounded-l-md last:rounded-r-md',
            'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
            key === value
              ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          ].join(' ')}
        >
          {INDEX_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
