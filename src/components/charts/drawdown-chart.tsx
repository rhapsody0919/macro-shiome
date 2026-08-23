'use client';

import { useMemo, useState } from 'react';
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
import { formatDate, formatNumber, formatSigned } from '@/lib/format';
import type { DrawdownAsset } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

/** 相対強度は下落率と別データキーに畳む。同じ日付行に両方を持たせるため。 */
const relativeKey = (id: string) => `${id}__rs`;

type Mode = 'drawdown' | 'relative';

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
  relativeStrengthStart,
  notes,
  explanation,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: DrawdownAsset[];
  /** 資産 ID → 線の色。 */
  colors: Readonly<Record<string, string>>;
  /**
   * 対SPY (相対強度) の起点 (#289)。下落率の起点 (2024-11-28、静的な文言) とは別物で、
   * データの蓄積状況で変わるためここで動的に受け取り、'relative' モードのときだけ出す。
   */
  relativeStrengthStart: string | null;
  notes: React.ReactNode[];
  /** 指標の読者向け解説 (#208)。`ChartFrame` にそのまま渡す。 */
  explanation?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));
  const [mode, setMode] = useState<Mode>('drawdown');

  // 資産ごとの系列を 1 つの配列に畳む。Recharts は行 = 日付の形を要る。
  // 下落率と相対強度は別キーに畳み、切替時にデータの作り直しをしない。
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | null | string>>();
    for (const asset of assets) {
      for (const point of asset.points) {
        const row = byDate.get(point.date) ?? { date: point.date };
        row[asset.id] = point.drawdown;
        byDate.set(point.date, row);
      }
      for (const point of asset.relativeStrengthPoints) {
        const row = byDate.get(point.date) ?? { date: point.date };
        row[relativeKey(asset.id)] = point.value;
        byDate.set(point.date, row);
      }
    }
    const rows = [...byDate.values()].sort((a, b) =>
      String(a.date) < String(b.date) ? -1 : 1,
    ) as Array<{ date: string }>;
    return filterByPeriod(rows, period, new Date());
  }, [assets, period]);

  // 下落率が大きい順、または対SPYの相対強度が高い順。「いま何が売られているか」
  // 「いまどこにSPYより資金が向いているか」がそのまま並ぶ。
  const ranked =
    mode === 'drawdown'
      ? [...assets]
          .filter((asset) => asset.latest !== null)
          .sort((a, b) => (b.latest?.drawdown ?? 0) - (a.latest?.drawdown ?? 0))
      : [...assets]
          .filter((asset) => asset.latestRelativeStrength !== null)
          .sort(
            (a, b) =>
              (b.latestRelativeStrength?.value ?? 0) - (a.latestRelativeStrength?.value ?? 0),
          );
  const rankedDate = mode === 'drawdown' ? ranked[0]?.latest?.date : ranked[0]?.latestRelativeStrength?.date;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      badges={badges}
      // セクション (問い) の中に置くので h3 にする (#77)。既定の h2 だと
      // 問いの見出しと同格に見え、構造が伝わらない。
      headingLevel={3}
      contentClassName="h-64 sm:h-80"
      actions={
        <div
          role="group"
          aria-label="下落率と対SPYの切替"
          className="inline-flex rounded-md border border-slate-300 dark:border-slate-700"
        >
          {(
            [
              { key: 'drawdown', label: '下落率' },
              { key: 'relative', label: '対SPY' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.key === mode}
              onClick={() => setMode(item.key)}
              className={[
                'px-3 py-1 text-xs first:rounded-l-md last:rounded-r-md',
                'border-r border-slate-300 last:border-r-0 dark:border-slate-700',
                item.key === mode
                  ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
      summary={
        <div className="space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {ranked.map((asset) => (
              <span key={asset.id} className="tabular-nums">
                <span className="inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: colors[asset.id] }} />{' '}
                <span className="text-slate-500">{asset.name}</span>{' '}
                <span className="font-semibold">
                  {mode === 'drawdown'
                    ? `${formatNumber(asset.latest?.drawdown ?? null, 1)}%`
                    : `${formatSigned(asset.latestRelativeStrength?.value ?? null, 1)}%`}
                </span>
              </span>
            ))}
            {rankedDate !== undefined && (
              <span className="text-[11px] text-slate-500">({formatDate(rankedDate)} 時点)</span>
            )}
          </div>
          {mode === 'relative' && relativeStrengthStart !== null && (
            <p className="text-[11px] text-slate-500">
              起点は {formatDate(relativeStrengthStart)} (この日の SPY との価格比率を 0% とする)。
              下落率の起点とは別。
            </p>
          )}
        </div>
      }
      notes={notes}
      explanation={explanation}
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          {/*
            **下落率は上下を反転させる。** 「大きいほど悪い」ので、
            そのまま描くと下げ相場で線が上に伸びて直感と逆になる。
            対SPYはゼロ (SPYと同じ) を基準に上下均等なので反転しない。
          */}
          <YAxis
            reversed={mode === 'drawdown'}
            domain={mode === 'drawdown' ? [0, 'auto'] : ['auto', 'auto']}
            width={48}
            fontSize={11}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<SharedTooltip kind="percent" />} />
          <Legend />
          {mode === 'relative' && (
            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />
          )}
          {assets.map((asset) => (
            <Line
              key={asset.id}
              type="monotone"
              dataKey={mode === 'drawdown' ? asset.id : relativeKey(asset.id)}
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
