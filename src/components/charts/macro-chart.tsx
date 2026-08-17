'use client';

import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Legend,
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
  headingLevel = 3,
  badges,
  signed = false,
  baseline,
  notes,
}: {
  points: MacroPoint[];
  title: string;
  subtitle?: string;
  series: SeriesDef[];
  kind?: ValueKind;
  /** セクション内に置くため既定は h3 (#77)。 */
  headingLevel?: 2 | 3;
  /** 更新頻度・景気サイクルのバッジ (#89)。 */
  badges?: ReactNode;
  /**
   * 符号が意味を持つ指標か (#63)。true ならゼロ線を引き、負の領域を薄く塗る。
   * イールドカーブのように「負になること自体が信号」の指標に使う。
   */
  signed?: boolean;
  /**
   * 基準線 (#87)。データの定義から決まる線だけを引く。
   * 「危険水準」のような恣意的な閾値には使わない。
   */
  baseline?: { value: number; label: string };
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
      headingLevel={headingLevel}
      badges={badges}
      contentClassName="h-56 sm:h-64"
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

          {baseline !== undefined && (
            <ReferenceLine
              y={baseline.value}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeDasharray="6 3"
              label={{ value: baseline.label, position: 'insideTopLeft', fontSize: 10 }}
            />
          )}

          {signed && (
            <>
              {/*
                負の領域を薄く塗る。データに依存しない固定領域なので、
                y1 は十分に下まで取る (自動スケールで表示範囲は調整される)。
              */}
              <ReferenceArea y1={-100} y2={0} fill="#ef4444" fillOpacity={0.07} />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />
            </>
          )}
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
