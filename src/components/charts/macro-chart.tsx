'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { changeMark, formatDate, formatNumber, formatSigned } from '@/lib/format';
import type { MacroPoint } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip, type ValueKind } from './chart-frame';

export interface SeriesDef {
  key: keyof MacroPoint;
  label: string;
  color: string;
}

/** 単一指標のチャート。VIX・為替のように 1 系列で完結するものに使う。 */
export function MacroChart({
  points,
  title,
  subtitle,
  series,
  kind = 'number',
  notes,
}: {
  points: MacroPoint[];
  title: string;
  subtitle?: string;
  series: SeriesDef[];
  kind?: ValueKind;
  notes: React.ReactNode[];
}) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const data = useMemo(
    () => filterByPeriod(points, period, new Date()),
    [points, period],
  );

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      contentClassName="h-64"
      summary={
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {series.map((s) => {
            const withValue = data.filter((point) => point[s.key] !== null);
            const last = withValue.at(-1);
            const prev = withValue.at(-2);
            const diff =
              last === undefined || prev === undefined
                ? null
                : (last[s.key] as number) - (prev[s.key] as number);

            return (
              <div key={String(s.key)}>
                <span className="text-xs text-slate-500">{s.label}</span>{' '}
                <span className="font-semibold tabular-nums">
                  {formatNumber((last?.[s.key] as number | null) ?? null, kind === 'percent' ? 2 : 2)}
                  {kind === 'percent' && '%'}
                </span>{' '}
                <span className="text-xs tabular-nums text-slate-500">
                  {changeMark(diff)} {formatSigned(diff, 2)}
                </span>
              </div>
            );
          })}
          {data.length > 0 && (
            <span className="text-xs text-slate-500">({formatDate(data.at(-1)?.date)} 時点)</span>
          )}
        </div>
      }
      notes={notes}
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          <YAxis
            domain={['auto', 'auto']}
            width={56}
            fontSize={11}
            tickFormatter={(value: number) =>
              kind === 'percent' ? `${value.toFixed(1)}%` : value.toLocaleString('ja-JP')
            }
          />
          <Tooltip content={<SharedTooltip kind={kind} />} />
          {series.length > 1 && <Legend />}
          {series.map((s) => (
            <Line
              key={String(s.key)}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              connectNulls={false}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
