import { formatNumber, formatPercent } from '@/lib/format';
import { pickLatest, stepLabel } from '@/lib/pick';
import type { MonthlyPoint } from '@/lib/data/types';
import { SummaryCard, SummaryGrid } from './summary-card';

/** "2026-06-01" → "2026年6月"。日付まで出すと発表日と誤解される。 */
function formatMonth(month: string | null): string | null {
  if (month === null) return null;
  const [year, m] = month.split('-');
  return `${year}年${Number.parseInt(m, 10)}月`;
}

/**
 * 経済統計画面の要約 (#76)。
 *
 * 6 チャートをスクロールしないと現状が分からなかったため、主要な月次指標を先頭に並べる。
 *
 * **カードごとに対象月が違う**。発表ラグが指標ごとに違うため、揃っているように
 * 見せてはいけない (#64)。各カードに対象月を出す。
 */
export function EconomySummary({ points }: { points: MonthlyPoint[] }) {
  const at = (point: MonthlyPoint) => point.month;
  const cpi = pickLatest(points, (p) => p.cpi, at);
  const employment = pickLatest(points, (p) => p.employmentLevel, at);
  const savings = pickLatest(points, (p) => p.savingsRate, at);
  const permits = pickLatest(points, (p) => p.buildingPermits, at);
  const sentiment = pickLatest(points, (p) => p.consumerSentiment, at);

  return (
    <SummaryGrid
      title="最新の状況"
      note="評価語は使わず数値と差分のみを示す。対象月は指標ごとに違う (発表時期が異なるため)。"
    >
      <SummaryCard
        label="建設許可"
        value={formatNumber(permits.value, 0)}
        delta={permits.delta}
        deltaLabel={stepLabel(permits.stepsBack, '月')}
        asOf={formatMonth(permits.at)}
        note="千戸。先行指標"
      />
      <SummaryCard
        label="就業者数"
        value={formatPercent(employment.value)}
        delta={employment.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(employment.stepsBack, '月')}
        asOf={formatMonth(employment.at)}
        note="前年同月比。自営業含む"
      />
      <SummaryCard
        label="貯蓄率"
        value={formatPercent(savings.value)}
        delta={savings.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(savings.stepsBack, '月')}
        asOf={formatMonth(savings.at)}
      />
      <SummaryCard
        label="CPI"
        value={formatPercent(cpi.value)}
        delta={cpi.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(cpi.stepsBack, '月')}
        asOf={formatMonth(cpi.at)}
        note="前年同月比"
      />
      <SummaryCard
        label="消費者信頼感"
        value={formatNumber(sentiment.value, 1)}
        delta={sentiment.delta}
        deltaLabel={stepLabel(sentiment.stepsBack, '月')}
        asOf={formatMonth(sentiment.at)}
        note="1966年Q1 = 100"
      />
    </SummaryGrid>
  );
}
