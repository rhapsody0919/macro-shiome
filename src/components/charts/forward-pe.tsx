'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { changeMark, formatDate, formatNumber, formatSigned } from '@/lib/format';
import type { ValuationView } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

const LINE_COLOR = '#8b5cf6';
const AVG_5Y_COLOR = '#94a3b8';
const AVG_10Y_COLOR = '#cbd5e1';

/**
 * Forward P/E と基準線 (spec F-3)。
 *
 * **S&P 500 専用**。基準線 (5年・10年平均) は FactSet が S&P 500 について出す値で、
 * NASDAQ-100 には存在しない。指数を切り替えても本チャートは S&P 500 のまま。
 */
export function ForwardPeChart({ view }: { view: ValuationView }) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const series = view.sp500;
  const points = useMemo(
    () => filterByPeriod(series.points, period, new Date()),
    [series.points, period],
  );

  const withPe = points.filter((point) => point.forwardPe !== null);
  const latest = withPe.at(-1) ?? null;
  const previous = withPe.at(-2) ?? null;

  const { pe5y, pe10y, asOf } = series.baselines;

  // 平均を上回っている領域を淡く塗る。位置関係を一目で分かるようにするため。
  // useMemo は使わない。要素数が数百で計算が軽く、依存に毎回新しい配列が入るため
  // React Compiler の最適化を妨げる。
  const peValues = withPe.map((point) => point.forwardPe as number);
  const upperBound = peValues.length === 0 ? null : Math.max(...peValues, pe5y ?? 0) * 1.02;

  return (
    <ChartFrame
      title="Forward P/E と基準線"
      subtitle="S&P 500 専用 (NASDAQ-100 には基準線が存在しない)"
      summary={
        latest === null ? (
          <p className="text-xs text-slate-500">この期間に表示できるデータが無い。</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-500">Forward P/E</span>{' '}
              <span className="font-semibold tabular-nums">{formatNumber(latest.forwardPe)}</span>{' '}
              <span className="text-xs tabular-nums text-slate-500">
                {changeMark(diff(latest.forwardPe, previous?.forwardPe))}{' '}
                {formatSigned(diff(latest.forwardPe, previous?.forwardPe))}
              </span>
              <span className="ml-1 text-[11px] text-slate-500">{formatDate(latest.date)}</span>
            </div>
            {/* 評価語 (割高/買い時) を使わず、事実として差分を示す (screens UI/UX 方針 2)。 */}
            <BaselineRelation label="5年平均" baseline={pe5y} current={latest.forwardPe} />
            <BaselineRelation label="10年平均" baseline={pe10y} current={latest.forwardPe} />
          </div>
        )
      }
      notes={[
        <>
          基準線は FactSet が毎週公表する値を取得したもの (取得日 {formatDate(asOf)})。
          固定値ではなく毎週更新される。
        </>,
        <>淡く塗った領域は 5 年平均を上回る範囲。線が途切れている箇所はレポート休刊による欠測。</>,
        <>
          PER は as-reported (GAAP) ベース。一般的な投資レポート (operating ベース) より高く出る。
        </>,
      ]}
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          <YAxis domain={['auto', 'auto']} width={48} fontSize={11} />
          <Tooltip content={<SharedTooltip />} />

          {pe5y !== null && upperBound !== null && (
            <ReferenceArea y1={pe5y} y2={upperBound} fill={LINE_COLOR} fillOpacity={0.07} />
          )}
          {pe10y !== null && (
            <ReferenceLine
              y={pe10y}
              stroke={AVG_10Y_COLOR}
              strokeDasharray="4 4"
              // 5 年平均と値が近いとラベルが重なるため、左右に振り分ける。
              label={{ value: `10年平均 ${pe10y}`, position: 'insideBottomRight', fontSize: 10 }}
            />
          )}
          {pe5y !== null && (
            <ReferenceLine
              y={pe5y}
              stroke={AVG_5Y_COLOR}
              strokeDasharray="6 3"
              label={{ value: `5年平均 ${pe5y}`, position: 'insideTopLeft', fontSize: 10 }}
            />
          )}

          <Line
            type="monotone"
            dataKey="forwardPe"
            name="Forward P/E"
            stroke={LINE_COLOR}
            strokeWidth={2.2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** 現在値と基準線の位置関係を事実として示す。 */
function BaselineRelation({
  label,
  baseline,
  current,
}: {
  label: string;
  baseline: number | null;
  current: number | null;
}) {
  if (baseline === null || current === null) {
    return (
      <div className="text-xs text-slate-500">
        {label} — 取得できていない
      </div>
    );
  }

  const gap = current - baseline;
  const direction = gap > 0 ? '上回る' : gap < 0 ? '下回る' : '一致';

  return (
    <div className="text-xs text-slate-500">
      {label} <span className="tabular-nums">{formatNumber(baseline)}</span> を{' '}
      <span className="font-semibold tabular-nums">{formatNumber(Math.abs(gap))}</span>
      {direction}
    </div>
  );
}

function diff(current: number | null, previous: number | null | undefined): number | null {
  if (current === null || previous === null || previous === undefined) return null;
  return current - previous;
}
