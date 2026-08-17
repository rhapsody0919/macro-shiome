'use client';

import { Children, type ReactNode } from 'react';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { describeAccumulation, type SeriesState } from '@/lib/series-state';

/** チャート共通の外枠。見出し・補助操作・注記の並びを揃える。 */
export function ChartFrame({
  title,
  subtitle,
  actions,
  summary,
  notes,
  contentClassName = 'h-64 sm:h-80',
  headingLevel = 2,
  state,
  stateLabel,
  stateNote,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  notes: ReactNode[];
  /** 図の高さ。2 段構成にする場合などに上書きする。 */
  contentClassName?: string;
  /**
   * 見出しのレベル (#77)。
   *
   * セクション (先行指標など) の中に置くチャートは h3 にする。同じ h2 だと
   * セクションとチャートが同格に見え、構造が伝わらない。
   */
  headingLevel?: 2 | 3;
  /**
   * 主系列の蓄積状況。`accumulating` なら図の代わりに状態表示を出す。
   * 各チャートで同じ分岐を書かずに済むよう枠側で引き受ける (#54)。
   */
  state?: SeriesState;
  /** 何の系列が足りないか (例: 「理論値」)。`state` を渡すなら必須。 */
  stateLabel?: string;
  /** 蓄積が要る理由。`ValuationSeries.accumulationNote` を渡す。 */
  stateNote?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {headingLevel === 3 ? (
            <h3 className="text-base font-bold">{title}</h3>
          ) : (
            <h2 className="text-base font-bold">{title}</h2>
          )}
          {subtitle !== undefined && (
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          )}
        </div>
        {actions}
      </header>

      {summary}

      <div className={`w-full ${contentClassName}`}>
        {state !== undefined && state.kind === 'accumulating' ? (
          <AccumulatingNotice
            state={state}
            label={stateLabel ?? 'データ'}
            note={stateNote ?? null}
          />
        ) : (
          children
        )}
      </div>

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

/**
 * 図の代わりに出す蓄積中の表示 (screens C-2)。
 *
 * 空のチャートを描くと「壊れている」ように見えるため、図の代わりにこれを出す。
 * 文面は `describeAccumulation` に集約し、注記に混ぜる場合と同じものを使う。
 */
function AccumulatingNotice({
  state,
  label,
  note,
}: {
  state: Extract<SeriesState, { kind: 'accumulating' }>;
  label: string;
  note: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-300 px-6 text-center dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {describeAccumulation(state, label, formatDate)}
      </p>
      {/* 恒久的な制約 (取得経路が無い) と区別できるよう、解消する見込みを添える。 */}
      <p className="text-xs text-slate-500">
        {note ?? ''} 週を追うごとに増える。
      </p>
    </div>
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
  labelFormatter = formatDate,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: unknown }>;
  label?: string;
  kind?: ValueKind;
  /** 系列以外に出したい情報 (最高値の注記など)。 */
  extra?: (point: unknown) => ReactNode;
  /** 見出しの整形。月次系列は日付でなく月として出す (#64)。 */
  labelFormatter?: (label: string | undefined) => string;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  return (
    <div className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mb-1 font-semibold">{labelFormatter(label)}</div>
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
