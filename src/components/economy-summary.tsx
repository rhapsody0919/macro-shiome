import { formatNumber, formatPercent } from '@/lib/format';
import { pickLatest, stepLabel } from '@/lib/pick';
import type { MacroPoint, MonthlyPoint } from '@/lib/data/types';
import { SummaryCard, SummaryGrid } from './summary-card';

/** "2026-06-01" → "2026年6月"。日付まで出すと発表日と誤解される。 */
function formatMonth(month: string | null): string | null {
  if (month === null) return null;
  const [year, m] = month.split('-');
  return `${year}年${Number.parseInt(m, 10)}月`;
}

/** "2026-06-05" → "2026/06/05"。 */
function formatDate(date: string | null): string | null {
  return date === null ? null : date.replace(/-/g, '/');
}

/**
 * 経済ページの要約 (#76 / #89)。
 *
 * **問いごとに 1 指標**を並べる。ページの見出し (問い) と同じ順序なので、
 * 気になったカードから対応するセクションを探せる。
 *
 * **カードごとに頻度と対象月が違う**。発表ラグが指標ごとに違うため、揃っているように
 * 見せてはいけない (#64)。各カードに時点を出す。
 */
export function EconomySummary({
  monthly,
  weekly,
}: {
  monthly: MonthlyPoint[];
  /** 週次系列。「景気は減速しているか」だけ最速の指標が週次のため受け取る。 */
  weekly: MacroPoint[];
}) {
  const atMonth = (point: MonthlyPoint) => point.month;
  const postings = pickLatest(weekly, (p) => p.newJobPostings, (p) => p.date);
  const employment = pickLatest(monthly, (p) => p.employmentLevel, atMonth);
  const retail = pickLatest(monthly, (p) => p.retailSales, atMonth);
  const cpi = pickLatest(monthly, (p) => p.cpi, atMonth);
  const permits = pickLatest(monthly, (p) => p.buildingPermits, atMonth);

  return (
    <SummaryGrid
      title="最新の状況"
      note="問いごとに 1 指標。評価語は使わず数値と差分のみを示す。時点は指標ごとに違う (頻度と発表時期が異なるため)。"
    >
      <SummaryCard
        label="新規求人 (Indeed)"
        value={formatNumber(postings.value, 1)}
        delta={postings.delta}
        deltaLabel={stepLabel(postings.stepsBack, '週')}
        asOf={formatDate(postings.at)}
        note="景気は減速しているか。週次"
      />
      <SummaryCard
        label="就業者数"
        value={formatPercent(employment.value)}
        delta={employment.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(employment.stepsBack, '月')}
        asOf={formatMonth(employment.at)}
        note="雇用と所得は保つか。家計調査 (自営業含む) の前年同月比"
      />
      <SummaryCard
        label="小売売上"
        value={formatPercent(retail.value)}
        delta={retail.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(retail.stepsBack, '月')}
        asOf={formatMonth(retail.at)}
        note="消費は続くか。自動車・ガソリン除く"
      />
      <SummaryCard
        label="CPI"
        value={formatPercent(cpi.value)}
        delta={cpi.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(cpi.stepsBack, '月')}
        asOf={formatMonth(cpi.at)}
        note="物価は落ち着くか。前年同月比"
      />
      <SummaryCard
        label="建設許可"
        value={formatNumber(permits.value, 0)}
        valueUnit="千戸"
        delta={permits.delta}
        deltaLabel={stepLabel(permits.stepsBack, '月')}
        asOf={formatMonth(permits.at)}
        note="住宅は動いているか。"
      />
    </SummaryGrid>
  );
}
