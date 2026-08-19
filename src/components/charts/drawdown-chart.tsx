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
import { formatDate, formatNumber } from '@/lib/format';
import type { DrawdownAsset } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

/**
 * 最高値からの下落率 (#128)。
 *
 * **水準が違う資産を同じ軸に載せるための正規化。** 金・原油・株価指数は
 * 水準では比べられないが、下落率なら並べられる。
 */
export function DrawdownChart({
  title,
  subtitle,
  assets,
  colors,
  notes,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: DrawdownAsset[];
  /** 資産 ID → 線の色。 */
  colors: Readonly<Record<string, string>>;
  notes: React.ReactNode[];
  badges?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  // 資産ごとの系列を 1 つの配列に畳む。Recharts は行 = 日付の形を要る。
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | null | string>>();
    for (const asset of assets) {
      for (const point of asset.points) {
        const row = byDate.get(point.date) ?? { date: point.date };
        row[asset.id] = point.drawdown;
        byDate.set(point.date, row);
      }
    }
    const rows = [...byDate.values()].sort((a, b) =>
      String(a.date) < String(b.date) ? -1 : 1,
    ) as Array<{ date: string }>;
    return filterByPeriod(rows, period, new Date());
  }, [assets, period]);

  // 下落率が大きい順。「いま何が売られているか」がそのまま並ぶ。
  const ranked = [...assets]
    .filter((asset) => asset.latest !== null)
    .sort((a, b) => (b.latest?.drawdown ?? 0) - (a.latest?.drawdown ?? 0));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      badges={badges}
      // セクション (問い) の中に置くので h3 にする (#77)。既定の h2 だと
      // 問いの見出しと同格に見え、構造が伝わらない。
      headingLevel={3}
      contentClassName="h-64 sm:h-80"
      summary={
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {ranked.map((asset) => (
            <span key={asset.id} className="tabular-nums">
              <span className="inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: colors[asset.id] }} />{' '}
              <span className="text-slate-500">{asset.name}</span>{' '}
              <span className="font-semibold">{formatNumber(asset.latest?.drawdown ?? null, 1)}%</span>
            </span>
          ))}
          {ranked[0]?.latest !== undefined && (
            <span className="text-[11px] text-slate-500">
              ({formatDate(ranked[0]?.latest?.date)} 時点)
            </span>
          )}
        </div>
      }
      notes={notes}
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          {/*
            **上下を反転させる。** 下落率は「大きいほど悪い」ので、
            そのまま描くと下げ相場で線が上に伸びて直感と逆になる。
          */}
          <YAxis
            reversed
            domain={[0, 'auto']}
            width={48}
            fontSize={11}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<SharedTooltip kind="percent" />} />
          <Legend />
          {assets.map((asset) => (
            <Line
              key={asset.id}
              type="monotone"
              dataKey={asset.id}
              name={asset.name}
              stroke={colors[asset.id]}
              strokeWidth={1.8}
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
