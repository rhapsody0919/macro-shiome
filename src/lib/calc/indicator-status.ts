/**
 * 指標ごとの取得状況ビュー (#330)。
 *
 * 「◯日空いたら異常」という閾値では判定しない (#52 と同じ判断)。直近の観測日を
 * そのまま並べて、間隔が普段と違うかを読み手が判断できるようにする。
 *
 * データ取得を伴わない (`data/observations/*.json` と `data/gaps.json` から組み立てる)
 * ため、`fetch-daily.ts` と `rebuild-views.ts` の両方から呼べる。
 */
import type { Gap, IndicatorMaster, IndicatorStatusView } from '../data/types';
import type { ObservationMap } from './view';

/** 指標ごとに表示する直近の観測日の件数。 */
const RECENT_DATES_COUNT = 5;

export function buildIndicatorStatusView(
  indicators: IndicatorMaster,
  observations: ObservationMap,
  gaps: readonly Gap[],
  generatedAt: string,
): IndicatorStatusView {
  // 指標ごとに最新の欠測 1 件だけを見る。同じ指標に複数の欠測記録があっても、
  // 「いま関係あるか」の判定に要るのは一番新しいものだけ (#142 と同じ考え方)。
  const latestGapByIndicator = new Map<string, Gap>();
  for (const g of gaps) {
    const existing = latestGapByIndicator.get(g.indicatorId);
    if (existing === undefined || g.date > existing.date) {
      latestGapByIndicator.set(g.indicatorId, g);
    }
  }

  const entries = Object.entries(indicators).map(([id, indicator]) => {
    const dates = Object.keys(observations[id] ?? {})
      .sort()
      .reverse()
      .slice(0, RECENT_DATES_COUNT);
    const latestDate = dates[0];
    const gap = latestGapByIndicator.get(id);
    // 欠測が直近の観測日より新しいときだけ「いま関係がある」とみなす。
    // 過去に解消済みの欠測 (例: 昨年の休刊週) を毎回表示すると、
    // 本当にいま止まっている指標を見分けられなくなる。
    const isRelevantGap = gap !== undefined && (latestDate === undefined || gap.date > latestDate);

    return {
      indicatorId: id,
      name: indicator.name,
      frequency: indicator.frequency,
      recentDates: dates,
      gapReason: isRelevantGap ? (gap?.detail ?? gap?.reason ?? null) : null,
    };
  });

  return { generatedAt, entries };
}
