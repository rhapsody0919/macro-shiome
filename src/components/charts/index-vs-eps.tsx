'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { changeMark, formatDate, formatNumber, formatSigned } from '@/lib/format';
import { change } from '@/lib/calc/derived';
import type { IndexKey, ValuationView } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { describeAccumulation, type SeriesState, seriesState } from '@/lib/series-state';

/** 系列の識別子。凡例トグルの対象。 */
type SeriesKey = 'index' | 'forwardEps' | 'trailingEps';

// ライト・ダークの両方で視認できる中間の明度を選ぶ。
// 背景に溶ける濃色 (slate-900 等) は使わない。
const SERIES: Array<{ key: SeriesKey; label: string; color: string; axis: 'left' | 'right' }> = [
  { key: 'index', label: '指数', color: '#64748b', axis: 'left' },
  { key: 'forwardEps', label: '予想EPS', color: '#3b82f6', axis: 'right' },
  { key: 'trailingEps', label: '実績EPS', color: '#f59e0b', axis: 'right' },
];

const INDEX_LABELS: Record<IndexKey, string> = {
  sp500: 'S&P 500',
  nasdaq100: 'NASDAQ-100',
};

export function IndexVsEpsChart({ view }: { view: ValuationView }) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const [indexKey, setIndexKey] = useState<IndexKey>('sp500');
  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(new Set());

  const series = view[indexKey];
  const points = useMemo(
    () => filterByPeriod(series.points, period, new Date()),
    [series.points, period],
  );

  // 系列ごとに「値を持つ最後の週」を探す。
  // 指数を基準にすると、FactSet 休刊週が最新のとき EPS が欠測表示になってしまう。
  //
  // useMemo は使わない。React Compiler が手動メモ化を変換する際に関数参照が壊れ、
  // 実行時に "buildSummary is not defined" になる (#44)。要素数が数百で計算は軽い。
  const summary = buildSummary(points);

  function toggle(key: SeriesKey) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visible = SERIES.filter((s) => {
    // NASDAQ-100 は Forward PER の取得経路が無いため、予想 EPS の系列自体を出さない。
    if (s.key === 'forwardEps' && !series.hasForwardEps) return false;
    return true;
  });

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">指数と EPS</h2>
        <IndexSwitch value={indexKey} onChange={setIndexKey} />
      </header>

      <LatestSummary indexKey={indexKey} summary={summary} hasForwardEps={series.hasForwardEps} />

      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
            <YAxis yAxisId="left" domain={['auto', 'auto']} width={64} fontSize={11} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={['auto', 'auto']}
              width={56}
              fontSize={11}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              onClick={(entry) => toggle(entry.dataKey as SeriesKey)}
              formatter={(value: string) => (
                <span className="cursor-pointer text-xs select-none">{value}</span>
              )}
            />
            {visible.map((s) => (
              <Line
                key={s.key}
                yAxisId={s.axis}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.2}
                hide={hidden.has(s.key)}
                // 既定で欠測が穴になる (ADR-0003)。前方補完すると欠測が見えなくなる。
                connectNulls={false}
                dot={(props) => <RecordHighDot {...props} seriesKey={s.key} color={s.color} />}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Notes
        indexKey={indexKey}
        hasForwardEps={series.hasForwardEps}
        pointCount={points.length}
        // 期間フィルター前の系列で判定する (絞っただけで蓄積中に見えないように)。
        trailingEpsState={seriesState(series.points, (point) => point.trailingEps)}
        accumulationNote={series.accumulationNote}
      />
    </section>
  );
}

/** 指数の切り替え。 */
function IndexSwitch({
  value,
  onChange,
}: {
  value: IndexKey;
  onChange: (key: IndexKey) => void;
}) {
  return (
    <div role="group" aria-label="指数" className="inline-flex rounded-md border border-slate-300 dark:border-slate-700">
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

/** 系列ごとの最新値と前週比。 */
interface SeriesSummary {
  key: SeriesKey;
  value: number | null;
  diff: number | null;
  date: string | null;
}

/**
 * 系列ごとに「値を持つ最後の週」と、その 1 つ前の値を探す。
 *
 * 指数を基準に最新週を決めると、FactSet 休刊週が最新のとき EPS が欠測表示になる。
 * 実際 2026-08-14 は休刊で、指数はあるが EPS が無い。
 */
function buildSummary(points: ValuationView['sp500']['points']): SeriesSummary[] {
  return SERIES.map(({ key }) => {
    const withValue = points.filter((point) => point[key] !== null);
    const last = withValue.at(-1) ?? null;
    const prev = withValue.at(-2) ?? null;
    return {
      key,
      value: last === null ? null : (last[key] as number),
      diff: last === null || prev === null ? null : (change(last[key], prev[key])?.absolute ?? null),
      date: last?.date ?? null,
    };
  });
}

function LatestSummary({
  indexKey,
  summary,
  hasForwardEps,
}: {
  indexKey: IndexKey;
  summary: SeriesSummary[];
  hasForwardEps: boolean;
}) {
  const labelOf = (key: SeriesKey) =>
    key === 'index' ? INDEX_LABELS[indexKey] : (SERIES.find((s) => s.key === key)?.label ?? key);

  const shown = summary.filter((item) => item.key !== 'forwardEps' || hasForwardEps);

  if (shown.every((item) => item.value === null)) {
    return <p className="text-xs text-slate-500">この期間に表示できるデータが無い。</p>;
  }

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {shown.map((item) => (
        <div key={item.key}>
          <span className="text-xs text-slate-500">{labelOf(item.key)}</span>{' '}
          <span className="font-semibold tabular-nums">{formatNumber(item.value, 2)}</span>{' '}
          <span className="text-xs tabular-nums text-slate-500">
            {changeMark(item.diff)} {formatSigned(item.diff, 2)}
          </span>
          {/* 系列ごとに最新週が違うため、日付も系列ごとに出す (休刊週があるため)。 */}
          <span className="ml-1 text-[11px] text-slate-500">{formatDate(item.date)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 過去最高値を更新した週にだけ点を描く (spec F-2)。
 * 参考にしている分析が毎週手作業で「(過去最高値)」と注記している部分の自動化。
 */
function RecordHighDot(props: {
  cx?: number;
  cy?: number;
  payload?: { isForwardEpsHigh?: boolean; isTrailingEpsHigh?: boolean };
  seriesKey: SeriesKey;
  color: string;
}) {
  const { cx, cy, payload, seriesKey, color } = props;
  if (cx === undefined || cy === undefined || payload === undefined) return <g />;

  const isHigh =
    seriesKey === 'forwardEps'
      ? payload.isForwardEpsHigh === true
      : seriesKey === 'trailingEps'
        ? payload.isTrailingEpsHigh === true
        : false;

  if (!isHigh) return <g />;
  return <circle cx={cx} cy={cy} r={1.9} fill={color} opacity={0.9} />;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: unknown }>;
  label?: string;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const point = payload[0]?.payload as
    | { isForwardEpsHigh?: boolean; isTrailingEpsHigh?: boolean }
    | undefined;

  return (
    <div className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mb-1 font-semibold">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <span className="ml-auto font-semibold">{formatNumber(entry.value ?? null, 2)}</span>
        </div>
      ))}
      {(point?.isForwardEpsHigh === true || point?.isTrailingEpsHigh === true) && (
        <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
          過去最高値を更新
          {point.isForwardEpsHigh === true && point.isTrailingEpsHigh === true
            ? ' (予想・実績)'
            : point.isForwardEpsHigh === true
              ? ' (予想EPS)'
              : ' (実績EPS)'}
        </div>
      )}
    </div>
  );
}

/** 誤読を防ぐための注記 (screens UI/UX 方針 1)。 */
function Notes({
  indexKey,
  hasForwardEps,
  pointCount,
  trailingEpsState,
  accumulationNote,
}: {
  indexKey: IndexKey;
  hasForwardEps: boolean;
  pointCount: number;
  /** 実績 EPS の蓄積状況。取得経路が無い場合と混同させない (前者は時間で解消する)。 */
  trailingEpsState: SeriesState;
  accumulationNote: string | null;
}) {
  return (
    <ul className="space-y-1 text-[11px] text-slate-500">
      <li>
        EPS は指数 ÷ PER で算出した導出値。PER は as-reported (GAAP) ベースのため、
        一般的な投資レポート (operating ベース) とは約 9% ずれる。
      </li>
      <li>凡例をクリックすると系列を隠せる。指数を隠せば EPS だけを比較できる。</li>
      <li>点は過去最高値を更新した週。線が途切れている箇所はデータの欠測 (補完しない)。</li>
      {!hasForwardEps && (
        <li className="text-amber-600 dark:text-amber-400">
          {INDEX_LABELS[indexKey]} は予想 PER の無料取得経路が無いため、予想 EPS を表示できない
          (蓄積待ちではなく恒久的な制約)。実績 EPS は ETF (QQQ) の PER 由来。
        </li>
      )}
      {trailingEpsState.kind === 'accumulating' && (
        <li className="text-slate-500">
          {describeAccumulation(trailingEpsState, '実績 EPS', formatDate)}
          {accumulationNote ?? ''} 週を追うごとに増える。
        </li>
      )}
      {pointCount === 0 && <li>選択した期間にデータが無い。</li>}
    </ul>
  );
}

