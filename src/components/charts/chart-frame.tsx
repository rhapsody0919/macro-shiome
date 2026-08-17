'use client';

import { Children, type ReactNode } from 'react';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

/** チャート共通の外枠。見出し・補助操作・注記の並びを揃える。 */
export function ChartFrame({
  title,
  subtitle,
  actions,
  summary,
  notes,
  contentClassName = 'h-80',
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  notes: ReactNode[];
  /** 図の高さ。2 段構成にする場合などに上書きする。 */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle !== undefined && (
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          )}
        </div>
        {actions}
      </header>

      {summary}

      <div className={`w-full ${contentClassName}`}>{children}</div>

      <ul className="space-y-1 text-[11px] text-slate-500">
        {/*
          呼び出し側は key を付けずに JSX の配列を渡す。Children.toArray が
          安定した key を振るため、React の key 警告が出ない。
        */}
        {Children.toArray(notes).map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

/** 単位に応じた表示。系列ごとに書き分けずに済むようにする。 */
export type ValueKind = 'number' | 'percent';

export function formatByKind(value: number | null | undefined, kind: ValueKind): string {
  return kind === 'percent' ? formatPercent(value) : formatNumber(value);
}

/** チャート共通のツールチップ。ホバー時に全系列の値を 1 か所にまとめて出す。 */
export function SharedTooltip({
  active,
  payload,
  label,
  kind = 'number',
  extra,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: unknown }>;
  label?: string;
  kind?: ValueKind;
  /** 系列以外に出したい情報 (最高値の注記など)。 */
  extra?: (point: unknown) => ReactNode;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  return (
    <div className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mb-1 font-semibold">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <span className="ml-auto font-semibold">{formatByKind(entry.value, kind)}</span>
        </div>
      ))}
      {extra?.(payload[0]?.payload)}
    </div>
  );
}
