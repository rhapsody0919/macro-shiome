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
import { COLORS } from '@/lib/colors';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { seriesState, withValue } from '@/lib/series-state';
import { ChartFrame, SharedTooltip } from './chart-frame';
import { DistributionPosition } from './distribution-position';
import { IndexSwitch } from '../index-switch';

const SPREAD_COLOR = COLORS.yieldSpread;
const POSITIVE_FILL = COLORS.yieldSpread;
const NEGATIVE_FILL = COLORS.negative;
const MEAN_COLOR = '#94a3b8';
const SIGMA_COLOR = '#cbd5e1';

/**
 * 内訳の系列。既定では隠し、必要なときだけ出す。
 *
 * **色は COLORS から引く。** 直書きしていたため「実質金利」がマクロ画面の金利チャートと
 * 別の色になっていた (#77)。
 */
const BREAKDOWN = [
  { key: 'earningsYield', label: '株式益回り', color: COLORS.earningsYield },
  { key: 'realRate', label: '実質金利', color: COLORS.realRate },
] as const;

/**
 * イールドスプレッド (spec F-4)。
 *
 * **株式益回り − 実質金利**。名目金利ではない。
 *
 * 実測 (2026-08-07) で益回り 5.00%、実質金利 2.40%、名目 10年債 4.65%。
 * 実質ベースなら **2.60%** だが名目ベースだと **0.35%** で、別の指標になってしまう。
 *
 * **この数値は再検証のたびに動く。** 主張 (実質と名目で別物になる) が成立しているかを
 * 確かめる材料として置いており、値そのものが仕様ではない (#182)。
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

  // NASDAQ-100 は益回りが実績 PER 由来で、その PER が過去に遡れない (#54)。
  // **期間フィルター前の系列**で判定する (フィルター後だと期間を絞っただけで蓄積中に見える)。
  const state = seriesState(series.points, (point) => point.yieldSpread);
  const isAccumulating = state.kind === 'accumulating';

  const withSpread = withValue(points, (point) => point.yieldSpread);
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
      state={state}
      stateLabel="スプレッド"
      stateNote={series.accumulationNote}
      actions={
        <div className="flex items-center gap-2">
          <IndexSwitch value={indexKey} onChange={setIndexKey} />
          {/* 図が出ない間は押しても何も起きないため隠す。 */}
          {!isAccumulating && (
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
          )}
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
            {/* 蓄積中は別途その旨を出すので、ここで「標本不足」を重ねない。 */}
            {!isAccumulating && (
              <DistributionPosition distribution={series.spreadDistribution} format={formatPercent} />
            )}
          </div>
        )
      }
      notes={[
        <>
          <strong>読み方:</strong> スプレッドが大きいほど、株式の益回りが実質金利を上回っている
          = 債券に対して株式の相対的な利回り優位が大きい。縮小はその優位が薄れることを意味し、
          <strong>ゼロを下回ると債券の実質利回りが株式の益回りを上回る</strong>。
          株式益回りの低下 (株高 or 業績悪化) と実質金利の上昇のどちらでも縮小する。
        </>,
        <>
          {/*
            **指数によって益回りの定義が違う** (#109)。S&P 500 は予想 PER、
            NASDAQ-100 は予想 PER が無いため実績 PER から出す。無条件に
            「Forward P/E」と書くと、NASDAQ-100 表示中に嘘になる。
          */}
          株式益回り = 1 ÷ {indexKey === 'sp500' ? 'Forward P/E' : '実績 P/E'} × 100、
          <strong>実質金利 = 10年債利回り − 期待インフレ率</strong>。
        </>,
        <>
          正 (青) は株式の益回りが実質金利を上回る局面、負 (赤) は下回る局面。ゼロ線を境に塗り分けている。
        </>,
        <>
          <strong>固定の「危険水準」は置いていない。</strong>
          「◯% を切ったら危険」という線には定説が無く、恣意的な基準になるため。
          客観的に言えるのは<strong>ゼロ (益回り = 実質金利) の境目</strong>と、
          <strong>過去の分布における現在の位置</strong>の 2 つだけ。破線が過去{' '}
          {series.spreadDistribution?.years ?? 5} 年の平均、点線が ±1σ (標本の約 7 割が入る範囲)。
        </>,
        <>
          「内訳を表示」で株式益回りと実質金利を個別に出せる。スプレッドの動きが株式側と金利側の
          どちらに由来するかを判別できる。
        </>,
        ...(indexKey === 'nasdaq100'
          ? [
              <>
                <strong>S&P 500 とは益回りの定義が違う。</strong>
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

          {/*
            過去分布の基準線。固定の閾値ではなく実データから求めた位置なので恣意性が無い。
            期間フィルターに追従しない固定窓の値を使う。
          */}
          {series.spreadDistribution !== null && (
            <>
              <ReferenceLine
                y={series.spreadDistribution.mean}
                stroke={MEAN_COLOR}
                strokeDasharray="6 3"
                label={{
                  value: `${series.spreadDistribution.years}年平均 ${series.spreadDistribution.mean.toFixed(2)}%`,
                  position: 'insideTopLeft',
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={series.spreadDistribution.mean + series.spreadDistribution.sd}
                stroke={SIGMA_COLOR}
                strokeDasharray="2 4"
              />
              <ReferenceLine
                y={series.spreadDistribution.mean - series.spreadDistribution.sd}
                stroke={SIGMA_COLOR}
                strokeDasharray="2 4"
                label={{ value: '±1σ', position: 'insideBottomLeft', fontSize: 10 }}
              />
            </>
          )}

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
