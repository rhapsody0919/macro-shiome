'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { changeMark, formatDate, formatNumber, formatSigned } from '@/lib/format';
import type { ValuationView } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { useChartPeriod } from '@/lib/use-chart-period';
import { ChartFrame, SharedTooltip } from './chart-frame';
import { ChartPeriodToggle } from './chart-period-toggle';
import { DistributionPosition } from './distribution-position';

const LINE_COLOR = '#0d9488';

/**
 * シラーPER (CAPE、#291、ADR-0010)。
 *
 * **既存の Forward/実績 PER (`ForwardPeChart`) とは重ねない別チャート。** 過去10年の
 * インフレ調整後平均利益で算出しており、単年の利益で算出する Forward/実績 PER とは
 * 定義が違う (#109、#116〜#118 で適用済みの原則)。S&P 500 専用で指数の切り替えも無い。
 */
export function ShillerPeChart({ view }: { view: ValuationView }) {
  const searchParams = useSearchParams();
  const globalPeriod = parsePeriod(searchParams.get('period'));
  const [period, setPeriod] = useChartPeriod(globalPeriod);

  const series = view.shillerPe;
  const points = useMemo(
    () => filterByPeriod(series.points, period, new Date()),
    [series.points, period],
  );

  const withValue = points.filter((point) => point.value !== null);
  const latest = withValue.at(-1) ?? null;
  const previous = withValue.at(-2) ?? null;
  const diff =
    latest === null || previous === null || previous.value === null || latest.value === null
      ? null
      : latest.value - previous.value;

  return (
    <ChartFrame
      title="シラーPER (CAPE)"
      subtitle="S&P 500 専用。過去10年の平均利益で算出する長期の PER"
      actions={<ChartPeriodToggle period={period} onChange={setPeriod} />}
      summary={
        latest === null || latest.value === null ? (
          <p className="text-xs text-slate-500">この期間に表示できるデータが無い。</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-500">シラーPER</span>{' '}
              <span className="font-semibold tabular-nums">{formatNumber(latest.value)}</span>{' '}
              <span className="text-xs tabular-nums text-slate-500">
                {changeMark(diff)} {formatSigned(diff)}
              </span>
              <span className="ml-1 text-[11px] text-slate-500">{formatDate(latest.date)}</span>
            </div>
            <DistributionPosition distribution={series.distribution} format={formatNumber} />
          </div>
        )
      }
      notes={[
        <span key="definition">
          <strong>物価変動を除いた株価を、過去10年間の物価変動を除いた平均利益で割った値。</strong>
          単年の利益で算出する上の Forward/実績 PER とは<strong>定義が違う</strong>ため重ねない。
          同じ軸に並べると水準の差が定義の違いなのか市場の変化なのか判別できなくなる。
        </span>,
        <span key="pace">
          過去10年平均で振れをならしているため、通常の PER より変化が緩やか。
          直近の変化よりも<strong>過去の水準との比較</strong>に向く指標。
        </span>,
        <span key="distribution">
          過去分布 (下位◯%) は直近5年の観測から求めた位置で、固定の「割高/割安」の
          閾値ではない (#271 と同じ考え方)。
        </span>,
        <span key="revision">
          出所 (Robert J. Shiller) は月次で更新しており、直近1〜2か月は物価指数が
          推計値のため後日改訂されることがある。
        </span>,
      ]}
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          <YAxis domain={['auto', 'auto']} width={48} fontSize={11} />
          <Tooltip content={<SharedTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name="シラーPER"
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
