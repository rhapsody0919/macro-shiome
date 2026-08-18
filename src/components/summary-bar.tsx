'use client';

import { useState } from 'react';
import { changeMark, formatDate, formatNumber, formatPercent, formatSigned } from '@/lib/format';
import type { IndexKey, ValuationPoint, ValuationView } from '@/lib/data/types';
import { INDEX_LABELS } from '@/lib/data/indices';
import { IndexSwitch } from './index-switch';

/** 前週比。前週が欠測なら 2 週前と比べ、その旨をラベルで示す。 */
interface Delta {
  value: number | null;
  /** 何週前と比べたか。1 なら前週、2 なら 2 週前。 */
  weeksBack: number;
}

/**
 * サマリーバー (screens C-1)。
 *
 * チャートを読む前に現状を把握できるよう、最新値を先頭に並べる。
 * 期間フィルターには依存しない (常に直近の値を見せる)。
 */
export function SummaryBar({ view }: { view: ValuationView }) {
  const [indexKey, setIndexKey] = useState<IndexKey>('sp500');
  const series = view[indexKey];
  const points = series.points;

  const index = pick(points, 'index');
  const forwardPe = pick(points, 'forwardPe');
  const spread = pick(points, 'yieldSpread');
  const over = pick(points, 'overvaluation');
  const fair = pick(points, 'fairValue');
  const correlation = series.correlation.oneYear;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">最新の状況</h2>
        <IndexSwitch value={indexKey} onChange={setIndexKey} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card
          label={INDEX_LABELS[indexKey]}
          value={formatNumber(index.value, 2)}
          delta={index.delta}
          date={index.date}
        />
        <Card
          label="Forward P/E"
          value={formatNumber(forwardPe.value, 2)}
          delta={forwardPe.delta}
          date={forwardPe.date}
          note={
            series.baselines.pe5y === null
              ? '基準線なし'
              : `5年平均 ${formatNumber(series.baselines.pe5y, 1)}`
          }
        />
        <Card
          label="イールドスプレッド"
          value={formatPercent(spread.value)}
          delta={spread.delta}
          deltaUnit="pt"
          date={spread.date}
          note="益回り − 実質金利"
        />
        {/* 割高率は設定依存の数値なので、理論値と基準益回りを必ず併記する (spec F-13)。 */}
        <Card
          label="割高率"
          value={formatSigned(over.value, 2, '%')}
          delta={over.delta}
          deltaUnit="pt"
          date={over.date}
          note={`理論値 ${formatNumber(fair.value, 0)} / 基準益回り ${formatPercent(series.targetYield)}`}
        />
        <Card
          label="指数と EPS の相関"
          value={correlation.kind === 'ok' ? formatNumber(correlation.r, 2) : 'データ不足'}
          delta={{ value: null, weeksBack: 1 }}
          note={`直近1年 / n = ${correlation.n}`}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        評価語は使わず数値と差分のみを示す。割高率は基準益回りの設定に依存する試算値。
      </p>
      {/*
        履歴が 1 週分しか無いと前週比が常に「—」になる。理由が無いと壊れて見える (#54)。
      */}
      {series.accumulationNote !== null && (
        <p className="text-[11px] text-slate-500">
          {INDEX_LABELS[indexKey]} は PER 由来の指標 (スプレッド・割高率・理論値)
          の履歴が蓄積中のため、前週比が出ないことがある。
          {series.accumulationNote} 週を追うごとに増える。
        </p>
      )}
    </section>
  );
}

function Card({
  label,
  value,
  delta,
  deltaUnit = '',
  date,
  note,
}: {
  label: string;
  value: string;
  delta: Delta;
  deltaUnit?: string;
  date?: string | null;
  note?: string;
}) {
  return (
    <div className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>

      <div className="text-[11px] tabular-nums text-slate-500">
        {delta.value === null ? (
          '前週比 —'
        ) : (
          <>
            {/* 色だけに頼らず記号でも向きを示す (screens UI/UX 方針 3)。 */}
            {changeMark(delta.value)} {formatSigned(delta.value, 2, deltaUnit)}
            {/* 前週が欠測なら何週前と比べたかを明示する (plan U-S3)。 */}
            <span className="ml-1">{delta.weeksBack === 1 ? '前週比' : `${delta.weeksBack}週前比`}</span>
          </>
        )}
      </div>

      {note !== undefined && <div className="mt-1 text-[10px] text-slate-500">{note}</div>}
      {date !== undefined && date !== null && (
        <div className="text-[10px] text-slate-400">{formatDate(date)}</div>
      )}
    </div>
  );
}

/**
 * 指定した項目の最新値と前週比を取り出す。
 *
 * 欠測週があるため「値を持つ週」だけを対象にし、直前の値との間隔を数えて
 * 「前週比」か「N 週前比」かを区別する (plan U-S3)。
 */
export function pick(
  points: readonly ValuationPoint[],
  key: 'index' | 'forwardPe' | 'yieldSpread' | 'overvaluation' | 'fairValue',
): { value: number | null; delta: Delta; date: string | null } {
  const withValue = points.filter((point) => point[key] !== null);
  const last = withValue.at(-1);
  const prev = withValue.at(-2);

  if (last === undefined) {
    return { value: null, delta: { value: null, weeksBack: 1 }, date: null };
  }
  if (prev === undefined) {
    return { value: last[key] as number, delta: { value: null, weeksBack: 1 }, date: last.date };
  }

  // 元の系列上で何週離れているかを数える。欠測を挟むと 2 以上になる。
  const lastIndex = points.indexOf(last);
  const prevIndex = points.indexOf(prev);

  return {
    value: last[key] as number,
    delta: {
      value: (last[key] as number) - (prev[key] as number),
      weeksBack: Math.max(1, lastIndex - prevIndex),
    },
    date: last.date,
  };
}
