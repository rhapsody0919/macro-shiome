'use client';

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
import { formatPercent } from '@/lib/format';
import type { EconomyView, PriceChainPoint } from '@/lib/data/types';
import { ChartFrame, SharedTooltip } from './chart-frame';

/**
 * 物価の連鎖 (#64)。
 *
 * 参考記事の読み方: **輸入物価 → 生産者物価 → CPI / PCE** の順に価格転嫁が進む。
 * 「輸入物価はアメリカ企業が海外から仕入れてる時の価格」であり、物価の起点になる。
 *
 * **すべて前年同月比**。指標ごとに基準年が違う (2000=100 / Nov 2009=100 /
 * 1982-84=100 / 2017=100) ため、水準を並べても比較にならない。
 */
const SERIES = [
  { key: 'importPrice', label: '輸入物価', color: '#f97316', width: 2.4 },
  { key: 'producerPrice', label: '生産者物価', color: '#a855f7', width: 2 },
  { key: 'cpi', label: 'CPI', color: '#0ea5e9', width: 2 },
  { key: 'pce', label: 'PCE', color: '#10b981', width: 2 },
] as const satisfies ReadonlyArray<{
  key: keyof PriceChainPoint;
  label: string;
  color: string;
  width: number;
}>;

/** 指標マスタの ID と表示名の対応。発表状況の表示に使う。 */
const COVERAGE_LABELS: Record<string, string> = {
  'import-price': '輸入物価',
  'producer-price': '生産者物価',
  cpi: 'CPI',
  'pce-price': 'PCE',
};

export function PriceChainChart({ view }: { view: EconomyView }) {
  const points = view.priceChain;

  return (
    <ChartFrame
      title="物価の連鎖"
      subtitle="輸入物価 → 生産者物価 → CPI / PCE (すべて前年同月比)"
      contentClassName="h-96"
      summary={
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            {SERIES.map((s) => {
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
                    {formatPercent(last?.[s.key] ?? null)}
                  </span>
                  {last !== undefined && (
                    <span className="ml-1 text-[11px] text-slate-500">
                      {formatMonth(last.month)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Coverage coverage={view.coverage} />
        </div>
      }
      notes={[
        <>
          <strong>読み方:</strong> 輸入物価は企業の仕入れ価格にあたり、物価の起点になる。
          上流 (輸入物価) の変化が生産者物価に転嫁され、さらに CPI / PCE に及ぶまでには
          <strong>時間差がある</strong>。上流が上を向いた時点で、下流の上昇余地が残っていると読める。
        </>,
        <>
          <strong>前年同月比で揃えている。</strong>
          指標ごとに基準年が違う (輸入物価 2000=100 / 生産者物価 Nov 2009=100 / CPI 1982-84=100 /
          PCE 2017=100) ため、水準を並べても比較にならない。
        </>,
        <>
          <strong>発表時期が指標ごとに違う。</strong>
          同じ月まで揃っていないことがあるため、線の右端がずれる。上の対象月を確認すること。
        </>,
        <>
          季節調整は輸入物価のみ無し、他は調整済み。前年同月比では季節性がおおむね相殺されるが、
          厳密には同一条件ではない。PCE は FRB が最も重視するインフレ指標。
        </>,
      ]}
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="month" tickFormatter={formatMonth} minTickGap={48} fontSize={11} />
          <YAxis
            domain={['auto', 'auto']}
            width={52}
            fontSize={11}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<SharedTooltip kind="percent" labelFormatter={formatMonth} />} />
          <Legend />
          {/* ゼロ線。物価下落 (デフレ) との境目。 */}
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width}
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
function Coverage({ coverage }: { coverage: EconomyView['coverage'] }) {
  const known = coverage.filter((item) => item.latestMonth !== null);
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
          {COVERAGE_LABELS[item.indicatorId] ?? item.indicatorId}{' '}
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
