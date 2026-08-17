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
import { changeMark, formatDate, formatPercent, formatSigned } from '@/lib/format';
import type { RevisionPoint } from '@/lib/data/types';
import { filterByPeriod, parsePeriod } from '@/lib/period';
import { ChartFrame, SharedTooltip } from './chart-frame';

const CURRENT_YEAR_COLOR = '#0ea5e9';
const NEXT_YEAR_COLOR = '#a855f7';

/**
 * 予想改定 (spec F-12)。
 *
 * アナリスト予想が先週・先月と比べて上がっているかを見る。**本アプリの主目的の 1 つ**。
 * 株価が崩れる前に業績期待の変調を捉えるための指標。
 *
 * forward 12M EPS の推移とは別物として扱う。forward 12M は四半期が進むと対象期間が
 * ロールするため、改定が無くても増益トレンド下では上昇する (週あたり約 0.3% のバイアス)。
 * 改定を純粋に見るには暦年固定の成長率を追う必要がある。
 */
export function RevisionsChart({ revisions }: { revisions: RevisionPoint[] }) {
  const searchParams = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));

  const points = useMemo(
    () => filterByPeriod(revisions, period, new Date()),
    [revisions, period],
  );

  // 3 時点 (今週 / 先週 / 四半期末) は最新のレポートに載っている値をそのまま使う。
  // 蓄積が無くても初週から表示できるのが利点。
  const latestWithBlended = points.filter((point) => point.blendedToday !== null).at(-1) ?? null;

  const withCurrentYear = points.filter((point) => point.growthCurrentYear !== null);
  const latestYear = withCurrentYear.at(-1) ?? null;
  const previousYear = withCurrentYear.at(-2) ?? null;

  // 提供元にデータが存在しない期間を注記で示すため、**期間フィルター前**の最初の観測日を使う。
  // フィルター後だと「絞った範囲の最初の日」になり、提供元の下限と混同される (#53)。
  const earliest = revisions.find((point) => point.growthCurrentYear !== null)?.date ?? null;

  return (
    <ChartFrame
      title="予想改定"
      subtitle="アナリストの増益率予想が先週・四半期末と比べてどう変わったか"
      summary={
        <div className="space-y-3">
          <BlendedComparison point={latestWithBlended} />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <YearlyItem
              label="今暦年の予想増益率"
              value={latestYear?.growthCurrentYear ?? null}
              previous={previousYear?.growthCurrentYear ?? null}
              date={latestYear?.date ?? null}
            />
            <YearlyItem
              label="翌暦年の予想増益率"
              value={latestYear?.growthNextYear ?? null}
              previous={previousYear?.growthNextYear ?? null}
              date={latestYear?.date ?? null}
            />
          </div>
        </div>
      }
      notes={[
        <>
          <strong>上の 3 時点は最新レポートに載っている値</strong>。蓄積が無くても初週から比較できる。
          下のグラフは週次で蓄積した暦年予想の推移。
        </>,
        <>
          前週差が正なら上方修正、負なら下方修正。株価が崩れる前に業績期待の変調が現れることがある。
        </>,
        <>
          予想 EPS の推移 (上のチャート) とは別物。予想 EPS は対象期間が毎週ロールするため、
          改定が無くても増益トレンド下では上昇する。純粋な改定はこちらで見る。
        </>,
        <>
          <strong>線が途切れる理由は 3 つある</strong> (いずれも補完しない)。
          <span className="mt-1 block">
            (1) <strong>提供元にその期間が無い</strong> —{' '}
            {earliest === null
              ? 'FactSet のレポートには取得できる期間の下限がある。'
              : `FactSet のレポートは ${formatDate(earliest)} 以降しか取得できない。`}
          </span>
          <span className="block">
            (2) <strong>休刊週</strong> — 年末年始・祝日週はレポート自体が出ない。
          </span>
          <span className="block">
            (3) <strong>その号に記載が無い</strong> —{' '}
            <strong>翌暦年 (紫) は年前半の号に載らない</strong>
            。FactSet は翌年の予想を年央 (6 月頃) から載せ始めるため、年前半で線が無いのは正常。
          </span>
        </>,
      ]}
    >
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={48} fontSize={11} />
          <YAxis
            domain={['auto', 'auto']}
            width={52}
            fontSize={11}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<SharedTooltip kind="percent" />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="growthCurrentYear"
            name="今暦年"
            stroke={CURRENT_YEAR_COLOR}
            strokeWidth={2.2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="growthNextYear"
            name="翌暦年"
            stroke={NEXT_YEAR_COLOR}
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

/**
 * 進行中四半期の増益率を 3 時点で並べる。
 * レポート本文に「今週 / 先週 / 四半期末」がそのまま書かれているため、
 * 蓄積ゼロの状態でも比較できる。
 */
function BlendedComparison({ point }: { point: RevisionPoint | null }) {
  if (point === null) {
    return <p className="text-xs text-slate-500">進行中四半期の増益率が取得できていない。</p>;
  }

  const items = [
    { label: '今週', value: point.blendedToday },
    { label: '先週', value: point.blendedLastWeek },
    { label: '四半期末時点', value: point.blendedQuarterEnd },
  ];
  const weekChange =
    point.blendedToday !== null && point.blendedLastWeek !== null
      ? point.blendedToday - point.blendedLastWeek
      : null;

  return (
    <div className="rounded border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="mb-2 text-xs text-slate-500">
        進行中四半期の増益率 ({formatDate(point.date)} 時点のレポート)
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="text-sm">
            <span className="text-xs text-slate-500">{item.label}</span>{' '}
            <span className="font-semibold tabular-nums">{formatPercent(item.value)}</span>
          </div>
        ))}
        <div className="text-sm">
          <span className="text-xs text-slate-500">前週差</span>{' '}
          <span className="font-semibold tabular-nums">
            {changeMark(weekChange)} {formatSigned(weekChange, 1, 'pt')}
          </span>
        </div>
      </div>
    </div>
  );
}

function YearlyItem({
  label,
  value,
  previous,
  date,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  date: string | null;
}) {
  const diff = value !== null && previous !== null ? value - previous : null;
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>{' '}
      <span className="font-semibold tabular-nums">{formatPercent(value)}</span>{' '}
      <span className="text-xs tabular-nums text-slate-500">
        {changeMark(diff)} {formatSigned(diff, 1, 'pt')}
      </span>
      <span className="ml-1 text-[11px] text-slate-500">{formatDate(date)}</span>
    </div>
  );
}
