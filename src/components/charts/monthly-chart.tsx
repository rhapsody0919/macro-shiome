'use client';

import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber, formatPercent } from '@/lib/format';
import type { EconomyView, MonthlyPoint } from '@/lib/data/types';
import { filterByMonth, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

/**
 * 月次指標のチャート (#64 / #66)。
 *
 * 横軸は**対象月**で、週次グリッドには載せない。系列と文言は呼び出し側が渡す。
 */
/**
 * 数値を持つフィールドだけを許す。`month` (string) を系列に指定すると
 * 表示時に型が合わず、実行時まで気付けない。
 */
type NumericKey = {
  [K in keyof MonthlyPoint]: MonthlyPoint[K] extends number | null ? K : never;
}[keyof MonthlyPoint];

export interface MonthlySeriesDef {
  key: NumericKey;
  label: string;
  color: string;
  /** 主系列は太くする。連鎖の起点や比較の基準を目立たせるため。 */
  width?: number;
  /** この系列に対応する指標マスタの ID。発表状況の表示に使う。 */
  indicatorId: string;
}

export function MonthlyChart({
  view,
  title,
  subtitle,
  series,
  kind = 'percent',
  headingLevel = 3,
  badges,
  zeroLine = true,
  baseline,
  notes,
  height = 'h-72 sm:h-96',
}: {
  view: EconomyView;
  title: string;
  subtitle: string;
  series: MonthlySeriesDef[];
  /** 前年同月比なら percent、水準なら number。 */
  kind?: 'percent' | 'number';
  /** セクション内に置くため既定は h3 (#77)。 */
  headingLevel?: 2 | 3;
  /** 更新頻度・景気サイクルのバッジ (#89)。 */
  badges?: ReactNode;
  /** ゼロ線を引くか。水準の指標 (貯蓄率・信頼感) では不要。 */
  zeroLine?: boolean;
  /**
   * 基準線 (#160)。**データの定義から決まる線だけ**を引く。
   * DI の 50 のように中立点が定義で決まっているものに使い、
   * 「危険水準」のような恣意的な閾値には使わない (#87 と同じ扱い)。
   */
  baseline?: { value: number; label: string };
  notes: ReactNode[];
  /** 図の高さ。モバイルは低くして縦の圧迫を避ける。 */
  height?: string;
}) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const points = useMemo(
    () => filterByMonth(view.monthly, period, new Date()),
    [view.monthly, period],
  );
  const labels = Object.fromEntries(series.map((s) => [s.indicatorId, s.label]));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      headingLevel={headingLevel}
      badges={badges}
      contentClassName={height}
      summary={
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            {series.map((s) => {
              // 系列ごとに最後に値がある月を探す。発表タイミングが指標ごとに違う。
              const withValue = points.filter((point) => point[s.key] !== null);
              const last = withValue.at(-1);
              return (
                <div key={s.key}>
                  <span className="text-xs" style={{ color: s.color }}>
                    ●
                  </span>{' '}
                  <span className="text-xs text-slate-500">{s.label}</span>{' '}
                  <span className="font-semibold tabular-nums">
                    {kind === 'percent'
                      ? formatPercent(last?.[s.key] ?? null)
                      : formatNumber(last?.[s.key] ?? null, 1)}
                  </span>
                  {last !== undefined && (
                    // 狭い画面では隠す。同じ情報が下の発表状況の行にある (#75)。
                    <span className="ml-1 hidden text-[11px] text-slate-500 sm:inline">
                      {formatMonth(last.month)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Coverage coverage={view.coverage} labels={labels} />
        </div>
      }
      notes={notes}
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="month" tickFormatter={formatMonth} minTickGap={48} fontSize={11} />
          <YAxis
            domain={['auto', 'auto']}
            width={52}
            fontSize={11}
            tickFormatter={(value: number) =>
              kind === 'percent' ? `${value.toFixed(0)}%` : value.toLocaleString('ja-JP')
            }
          />
          <Tooltip content={<SharedTooltip kind={kind} labelFormatter={formatMonth} />} />
          <Legend />
          {/* ゼロ線。前年同月比では増減の境目になる。 */}
          {zeroLine && <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />}
          {baseline !== undefined && (
            <ReferenceLine
              y={baseline.value}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeDasharray="6 3"
              label={{ value: baseline.label, position: 'insideTopLeft', fontSize: 10 }}
            />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width ?? 2}
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

/** どの月まで発表されているかを指標ごとに出す。 */
function Coverage({
  coverage,
  labels,
}: {
  coverage: EconomyView['coverage'];
  labels: Record<string, string>;
}) {
  // このチャートが使う指標だけに絞る。関係ない指標の発表状況を出しても意味が無い。
  const known = coverage.filter(
    (item) => item.latestMonth !== null && labels[item.indicatorId] !== undefined,
  );
  if (known.length === 0) return null;

  // 全部同じ月なら 1 行で済ませる。ずれているときだけ指標ごとに出す。
  const months = new Set(known.map((item) => item.latestMonth));
  if (months.size === 1) {
    return (
      <p className="text-[11px] text-slate-500">
        最新は全指標とも {formatMonth(known[0].latestMonth as string)} 分。
      </p>
    );
  }

  return (
    <p className="text-[11px] text-slate-500">
      発表済みの最新月:{' '}
      {known.map((item, i) => (
        <span key={item.indicatorId}>
          {i > 0 && ' / '}
          {labels[item.indicatorId]}{' '}
          {formatMonth(item.latestMonth as string)}
        </span>
      ))}
    </p>
  );
}

/** "2026-06-01" → "2026年6月"。日付まで出すと発表日と誤解されるため月までにする。 */
function formatMonth(month: string | undefined): string {
  if (month === undefined) return '—';
  const [year, m] = month.split('-');
  return `${year}年${Number.parseInt(m, 10)}月`;
}
