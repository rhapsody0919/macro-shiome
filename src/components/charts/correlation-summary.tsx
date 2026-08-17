'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/format';
import type { CorrelationValue, IndexKey, ValuationView } from '@/lib/data/types';

const INDEX_LABELS: Record<IndexKey, string> = {
  sp500: 'S&P 500',
  nasdaq100: 'NASDAQ-100',
};

const WINDOWS = [
  { key: 'halfYear', label: '直近半年' },
  { key: 'oneYear', label: '直近1年' },
  { key: 'all', label: '全期間' },
] as const;

/**
 * 相関サマリー (spec F-5)。
 *
 * 指数と EPS の相関を 3 つの窓で並べる。
 * **期間フィルターに追従しない**。3 期間を並べて比べること自体が目的で、
 * フィルターで窓が変わると意味を失うため。
 */
export function CorrelationSummary({ view }: { view: ValuationView }) {
  const [indexKey, setIndexKey] = useState<IndexKey>('sp500');
  const series = view[indexKey];

  // S&P 500 は予想 EPS、NASDAQ-100 は取得経路が無いため実績 EPS との相関になる。
  const epsLabel = series.hasForwardEps ? '予想EPS' : '実績EPS';

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">指数と EPS の相関</h2>
          <p className="text-[11px] text-slate-500">
            {INDEX_LABELS[indexKey]} と {epsLabel} のピアソン相関係数
          </p>
        </div>
        <div
          role="group"
          aria-label="指数"
          className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
        >
          {(Object.keys(INDEX_LABELS) as IndexKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === indexKey}
              onClick={() => setIndexKey(key)}
              className={[
                'px-3 py-1 text-xs first:rounded-l-md last:rounded-r-md',
                'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
                key === indexKey
                  ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {INDEX_LABELS[key]}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {WINDOWS.map((window) => (
          <CorrelationCard
            key={window.key}
            label={window.label}
            value={series.correlation[window.key]}
          />
        ))}
      </div>

      <ul className="space-y-1 text-[11px] text-slate-500">
        <li>
          <strong>このカードだけは期間フィルターの対象外。</strong>
          3 つの窓を並べて比べること自体が目的のため。
        </li>
        <li>
          両方に値がある週だけを使う (片方が欠測の週は除外)。標本数が 10 未満のときは
          偶然で大きく振れるため数値を出さない。
        </li>
        <li>
          相関が高いほど、株価の動きが業績で説明できていることを意味する。
          因果ではなく連動の強さを示す指標。
        </li>
      </ul>
    </section>
  );
}

function CorrelationCard({ label, value }: { label: string; value: CorrelationValue }) {
  return (
    <div className="rounded border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{label}</div>

      {value.kind === 'insufficient' ? (
        <>
          <div className="mt-1 text-lg font-semibold text-slate-400">データ不足</div>
          <div className="text-[11px] text-slate-500">n = {value.n} (10 未満)</div>
        </>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(value.r, 2)}
          </div>
          <div className="text-[11px] text-slate-500">n = {value.n}</div>
          <CorrelationBar r={value.r} />
        </>
      )}
    </div>
  );
}

/** −1〜+1 のスケール上で位置を示す。数値だけより強さが掴みやすい。 */
function CorrelationBar({ r }: { r: number }) {
  // −1 を 0%、+1 を 100% に写す。
  const position = ((r + 1) / 2) * 100;

  return (
    <div className="mt-2">
      <div className="relative h-1.5 rounded bg-slate-200 dark:bg-slate-800">
        {/* ゼロ (無相関) の位置。正負の境目が分かるようにする。 */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-400 dark:bg-slate-600" />
        <div
          className={`absolute top-0 bottom-0 w-1.5 rounded ${
            r >= 0 ? 'bg-blue-500' : 'bg-red-500'
          }`}
          style={{ left: `calc(${position}% - 3px)` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  );
}
