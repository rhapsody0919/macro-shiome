'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { changeMark, formatDate, formatPercent, formatSigned } from '@/lib/format';
import type { IndexKey, ValuationView } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

const SPREAD_COLOR = '#0ea5e9';
const POSITIVE_FILL = '#0ea5e9';
const NEGATIVE_FILL = '#ef4444';

/** 内訳の系列。既定では隠し、必要なときだけ出す。 */
const BREAKDOWN = [
  { key: 'earningsYield', label: '株式益回り', color: '#8b5cf6' },
  { key: 'realRate', label: '実質金利', color: '#f97316' },
] as const;

const INDEX_LABELS: Record<IndexKey, string> = {
  sp500: 'S&P 500',
  nasdaq100: 'NASDAQ-100',
};

/**
 * イールドスプレッド (spec F-4)。
 *
 * **株式益回り − 実質金利**。名目金利ではない。
 * 実測 (2026-08 時点) で実質金利ベースが 2.23% なのに対し、名目ベースだと −0.01% になり、
 * 別の指標になってしまう。
 */
export function YieldSpreadChart({ view }: { view: ValuationView }) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const [indexKey, setIndexKey] = useState<IndexKey>('sp500');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const series = view[indexKey];
  const points = useMemo(
    () => filterByPeriod(series.points, period, new Date()),
    [series.points, period],
  );

  // 正負で塗り分けるため、符号ごとの系列に分ける。
  // 1 本の Area を条件で塗り分ける手段が無いため、2 本重ねる。
  const data = points.map((point) => ({
    ...point,
    spreadPositive: point.yieldSpread !== null && point.yieldSpread >= 0 ? point.yieldSpread : null,
    spreadNegative: point.yieldSpread !== null && point.yieldSpread < 0 ? point.yieldSpread : null,
  }));

  const withSpread = points.filter((point) => point.yieldSpread !== null);
  const latest = withSpread.at(-1) ?? null;
  const previous = withSpread.at(-2) ?? null;
  const diff =
    latest === null || previous === null
      ? null
      : (latest.yieldSpread as number) - (previous.yieldSpread as number);

  return (
    <ChartFrame
      title="イールドスプレッド"
      subtitle="株式益回り − 実質金利 (名目金利ではない)"
      actions={
        <div className="flex items-center gap-2">
          <IndexSwitch value={indexKey} onChange={setIndexKey} />
          <button
            type="button"
            aria-pressed={showBreakdown}
            onClick={() => setShowBreakdown((v) => !v)}
            className={[
              'rounded-md border px-2 py-1 text-xs',
              showBreakdown
                ? 'border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-800'
                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
            ].join(' ')}
          >
            内訳を表示
          </button>
        </div>
      }
      summary={
        latest === null ? (
          <p className="text-xs text-slate-500">この期間に表示できるデータが無い。</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-500">スプレッド</span>{' '}
              <span className="font-semibold tabular-nums">{formatPercent(latest.yieldSpread)}</span>{' '}
              <span className="text-xs tabular-nums text-slate-500">
                {changeMark(diff)} {formatSigned(diff, 2, 'pt')}
              </span>
              <span className="ml-1 text-[11px] text-slate-500">{formatDate(latest.date)}</span>
            </div>
            <div className="text-xs text-slate-500">
              株式益回り {formatPercent(latest.earningsYield)} − 実質金利{' '}
              {formatPercent(latest.realRate)}
            </div>
          </div>
        )
      }
      notes={[
        <>
          株式益回り = 1 ÷ Forward P/E × 100、<strong>実質金利 = 10年債利回り − 期待インフレ率</strong>。
        </>,
        <>
          正 (青) は株式の益回りが実質金利を上回る局面、負 (赤) は下回る局面。ゼロ線を境に塗り分けている。
        </>,
        <>
          「内訳を表示」で株式益回りと実質金利を個別に出せる。スプレッドの動きが株式側と金利側の
          どちらに由来するかを判別できる。
        </>,
        ...(indexKey === 'nasdaq100'
          ? [
              <>
                NASDAQ-100 は予想 PER が無いため、益回りは実績 PER から算出している
                (S&P 500 は予想ベース)。同じ指標として比較しない。
              </>,
            ]
          : []),
      ]}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          <YAxis
            domain={['auto', 'auto']}
            width={52}
            fontSize={11}
            tickFormatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Tooltip content={<SharedTooltip kind="percent" />} />
          {showBreakdown && <Legend />}

          {/* ゼロ線。符号の境目が読み取れるようにする。 */}
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />

          <Area
            type="monotone"
            dataKey="spreadPositive"
            name="スプレッド (正)"
            stroke="none"
            fill={POSITIVE_FILL}
            fillOpacity={0.18}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="spreadNegative"
            name="スプレッド (負)"
            stroke="none"
            fill={NEGATIVE_FILL}
            fillOpacity={0.18}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="yieldSpread"
            name="スプレッド"
            stroke={SPREAD_COLOR}
            strokeWidth={2.2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />

          {showBreakdown &&
            BREAKDOWN.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={1.4}
                strokeDasharray="4 3"
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function IndexSwitch({
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
      {(Object.keys(INDEX_LABELS) as IndexKey[]).map((key) => (
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
