import type { HistoricalDistribution } from '@/lib/data/types';

/**
 * 過去分布における現在値の位置 (#52、#271)。
 *
 * **「危険」「割安」といった評価語は使わない** (screens UI/UX 方針 2)。
 * 分位と平均との差という事実だけを出し、判断は読み手に委ねる。
 * イールドスプレッド (%) と PER (倍) では表示形式が違うため `format` で差し替える。
 */
export function DistributionPosition({
  distribution,
  format,
}: {
  distribution: HistoricalDistribution | null;
  format: (value: number) => string;
}) {
  if (distribution === null) {
    return <div className="text-xs text-slate-500">過去分布は標本不足で出せない</div>;
  }

  const gap = distribution.latest - distribution.mean;

  return (
    <div className="text-xs text-slate-500">
      過去 {distribution.years} 年で下位{' '}
      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
        {distribution.latestPercentile.toFixed(0)}%
      </span>{' '}
      の水準 (平均 {format(distribution.mean)} を{' '}
      <span className="tabular-nums">{format(Math.abs(gap))}</span>{' '}
      {gap >= 0 ? '上回る' : '下回る'} / n = {distribution.n})
    </div>
  );
}
