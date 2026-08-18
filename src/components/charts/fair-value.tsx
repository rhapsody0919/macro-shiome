'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fairValue, overvaluation } from '@/lib/calc/derived';
import { changeMark, formatDate, formatNumber, formatPercent, formatSigned } from '@/lib/format';
import type { IndexKey, ValuationView } from '@/lib/data/types';
import { INDEX_LABELS } from '@/lib/data/indices';
import { IndexSwitch } from '../index-switch';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { seriesState, withValue } from '@/lib/series-state';
import { ChartFrame, SharedTooltip } from './chart-frame';

const INDEX_COLOR = '#64748b';
const FAIR_COLOR = '#10b981';
const OVER_FILL = '#ef4444';
const UNDER_FILL = '#10b981';

/**
 * 理論値と割高率 (spec F-13)。
 *
 * 理論値 = 実績 EPS ÷ 基準益回り、割高率 = 1 − 理論値 ÷ 指数値。
 *
 * **基準益回りは外部から取得できる値ではなく、成長率見通しに基づく裁量パラメータ**。
 * したがって理論値・割高率は客観的な絶対値ではない。設定値を常に画面に出す。
 */
export function FairValueChart({ view }: { view: ValuationView }) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const [indexKey, setIndexKey] = useState<IndexKey>('sp500');
  const series = view[indexKey];

  // 既定値は data/config.json 由来。画面での変更は一時的な試算で、保存はしない。
  const defaultYield = series.targetYield;
  const [targetYield, setTargetYield] = useState<number>(defaultYield);
  const isModified = Math.abs(targetYield - defaultYield) > 1e-9;

  const points = useMemo(
    () => filterByPeriod(series.points, period, new Date()),
    [series.points, period],
  );

  // 基準益回りを変えたときはクライアント側で再計算する。
  // 計算式はビュー生成と同じ純関数を使い、定義がずれないようにする。
  const data = points.map((point) => {
    const fair = isModified ? fairValue(point.trailingEps, targetYield) : point.fairValue;
    const over = isModified ? overvaluation(fair, point.index) : point.overvaluation;
    return {
      ...point,
      fairValue: fair,
      overvaluation: over,
      overPositive: over !== null && over >= 0 ? over : null,
      overNegative: over !== null && over < 0 ? over : null,
    };
  });

  // 線を引けるだけの蓄積があるか (#54)。**期間フィルター前の系列**で判定する。
  // フィルター後で判定すると、期間を絞っただけで「蓄積中」と出てしまう。
  const state = seriesState(series.points, (point) => point.fairValue);

  const withFair = withValue(data, (point) => point.fairValue);
  const latest = withFair.at(-1) ?? null;
  const previous = withFair.at(-2) ?? null;
  const overDiff =
    latest?.overvaluation !== null && latest !== null && previous?.overvaluation !== null && previous !== null
      ? (latest.overvaluation as number) - (previous.overvaluation as number)
      : null;

  return (
    <ChartFrame
      title="理論値と割高率"
      subtitle="理論値 = 実績EPS ÷ 基準益回り / 割高率 = 1 − 理論値 ÷ 指数"
      contentClassName="h-96 sm:h-[28rem]"
      state={state}
      stateLabel="理論値"
      stateNote={series.accumulationNote}
      actions={<IndexSwitch value={indexKey} onChange={setIndexKey} />}
      summary={
        <div className="space-y-3">
          {latest === null ? (
            <p className="text-xs text-slate-500">この期間に表示できるデータが無い。</p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-500">割高率</span>{' '}
                <span className="font-semibold tabular-nums">
                  {formatSigned(latest.overvaluation, 2, '%')}
                </span>{' '}
                <span className="text-xs tabular-nums text-slate-500">
                  {changeMark(overDiff)} {formatSigned(overDiff, 2, 'pt')}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                理論値 <span className="tabular-nums">{formatNumber(latest.fairValue, 0)}</span> ／
                指数 <span className="tabular-nums">{formatNumber(latest.index, 0)}</span>
                <span className="ml-1">({formatDate(latest.date)})</span>
              </div>
            </div>
          )}

          <TargetYieldControl
            value={targetYield}
            defaultValue={defaultYield}
            onChange={setTargetYield}
            isModified={isModified}
            context={series.targetYieldContext}
          />
        </div>
      }
      notes={[
        <>
          <strong>この数値は基準益回りの設定に依存する。</strong>
          客観的な絶対値ではなく、成長率見通しに基づく裁量パラメータで決まる試算値。
        </>,
        <>
          <strong>理論値は週の途中で動かない。</strong>
          実績 EPS が週次更新のため、週内は理論値が横ばいで割高率だけが指数の変動で動く
          (実績 EPS の更新日: {formatDate(latest?.date)})。
        </>,
        <>
          画面での基準益回りの変更は一時的な試算。恒久的に変えるには
          <code className="mx-1">data/config.json</code>
          を更新する (変更理由の記録が必須)。
        </>,
      ]}
    >
      <div className="flex h-full flex-col gap-1">
        {/* 上段: 理論値と指数の乖離 */}
        <div className="h-3/5">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="date" tick={false} height={1} />
              <YAxis domain={['auto', 'auto']} width={64} fontSize={11} />
              <Tooltip content={<SharedTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="index"
                name={INDEX_LABELS[indexKey]}
                stroke={INDEX_COLOR}
                strokeWidth={2}
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="fairValue"
                name="理論値"
                stroke={FAIR_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 下段: 割高率。ゼロ線を境に塗り分ける。 */}
        <div className="h-2/5">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
              <YAxis
                domain={['auto', 'auto']}
                width={64}
                fontSize={11}
                tickFormatter={(value: number) => `${value.toFixed(0)}%`}
              />
              <Tooltip content={<SharedTooltip kind="percent" />} />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />
              <Area
                type="monotone"
                dataKey="overPositive"
                name="割高"
                stroke="none"
                fill={OVER_FILL}
                fillOpacity={0.2}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="overNegative"
                name="割安"
                stroke="none"
                fill={UNDER_FILL}
                fillOpacity={0.2}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="overvaluation"
                name="割高率"
                stroke={OVER_FILL}
                strokeWidth={1.8}
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartFrame>
  );
}

/** 基準益回りの設定 UI。設定値を常に見せることが要件 (spec F-13)。 */
function TargetYieldControl({
  value,
  defaultValue,
  onChange,
  isModified,
  context,
}: {
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  isModified: boolean;
  context: ValuationView['sp500']['targetYieldContext'];
}) {
  // 実質金利が設定時から大きく動いていたら見直しを促す。
  // 0.5pt は「四半期に一度は見直す」程度の頻度になる目安。
  const needsReview = context.drift !== null && Math.abs(context.drift) >= 0.5;

  return (
    <div className="space-y-1 rounded border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="target-yield" className="text-slate-600 dark:text-slate-300">
        基準益回り
      </label>
      <input
        id="target-yield"
        type="number"
        step={0.01}
        min={0.5}
        max={15}
        value={value}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          if (Number.isFinite(next) && next > 0) onChange(next);
        }}
        className="w-20 rounded border border-slate-300 bg-transparent px-2 py-1 tabular-nums dark:border-slate-700"
      />
      <span className="text-slate-500">%</span>

      {isModified ? (
        <>
          <span className="text-amber-600 dark:text-amber-400">
            試算中 (既定 {formatPercent(defaultValue)})
          </span>
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            既定に戻す
          </button>
        </>
      ) : (
        <span className="text-slate-500">data/config.json の設定値</span>
      )}
    </div>

    {/* 裁量で置いている部分 (リスクプレミアム) がいくつなのかを可視化する (#46)。 */}
    {context.realRateAtSetting !== null && context.riskPremium !== null && (
      <div className="text-[11px] text-slate-500">
        参考: 設定時の実質金利 {formatPercent(context.realRateAtSetting)} + プレミアム{' '}
        {formatPercent(context.riskPremium)}
        {context.currentRealRate !== null && (
          <> ／ 現在の実質金利 {formatPercent(context.currentRealRate)}</>
        )}
      </div>
    )}

    {needsReview && (
      <div className="text-[11px] text-amber-600 dark:text-amber-400">
        実質金利が設定時から {formatSigned(context.drift, 2, 'pt')} 変化している。
        基準益回りの見直しを検討する (自動では変更しない)。
      </div>
    )}
    </div>
  );
}

