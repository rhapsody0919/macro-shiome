/**
 * 指標の発表予定カレンダー (#270)。
 *
 * 「次はいつ更新されるか」が画面から分からず、バッチが壊れていると誤解される
 * 余地があったための対応。過去の実績 (鮮度バッジ、#11) とは役割が違い、
 * 未来の予定を示す。取得できなければ null にする (「不明」表示、#102 と同じ判断)。
 *
 * 対象は FRED と FactSet 由来の指標。財務省の入札予定・統計ダッシュボードの
 * 公表予定は未確認のため対象外 (Issue #270 の調査で保留)。
 */
import { resolveFactsetNextIssueDate } from '../adapters/factset';
import type { FredClient } from '../adapters/fred';
import type { IndicatorMaster, ReleaseCalendarEntry, ReleaseCalendarView } from '../data/types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface BuildReleaseCalendarOptions {
  indicators: IndicatorMaster;
  fred: FredClient;
  now: Date;
  /** 個別の失敗を呼び出し側に伝える (fetch-daily.ts の failures 配列に積む用)。 */
  onError?: (message: string) => void;
  /** テストで実ネットワークを避けるための差し替え口。既定は実装 (`resolveFactsetNextIssueDate`)。 */
  resolveFactsetDate?: typeof resolveFactsetNextIssueDate;
}

/**
 * FRED は複数の指標が同じリリース (発表元の一連の統計) に属することが多いため、
 * リリース単位でまとめてから発表予定日を 1 回だけ問い合わせる。
 *
 * 指標マスタに FRED 系指標を 1 件足すだけで自動的にカレンダーにも乗る
 * (ADR-0004 の「新しい FRED 系指標は 1 エントリ足すだけ」という設計を踏襲)。
 * 手作業でどの指標を対象にするかを選ばない。
 */
export async function buildReleaseCalendar(
  options: BuildReleaseCalendarOptions,
): Promise<ReleaseCalendarView> {
  const { indicators, fred, now, onError, resolveFactsetDate = resolveFactsetNextIssueDate } = options;
  const todayIso = now.toISOString().slice(0, 10);
  const entries: ReleaseCalendarEntry[] = [];

  const releaseGroups = new Map<number, { name: string; indicatorIds: string[] }>();
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'fred') continue;
    try {
      const release = await fred.fetchSeriesRelease(indicator.source.seriesId);
      const group = releaseGroups.get(release.id) ?? { name: release.name, indicatorIds: [] };
      group.indicatorIds.push(id);
      releaseGroups.set(release.id, group);
    } catch (error) {
      onError?.(`release-calendar FRED ${id}: ${errorMessage(error)}`);
    }
  }
  for (const [releaseId, group] of releaseGroups) {
    try {
      const nextReleaseDate = await fred.fetchNextReleaseDate(releaseId, todayIso);
      entries.push({
        label: group.name,
        indicatorIds: group.indicatorIds,
        nextReleaseDate,
        source: 'fred',
      });
    } catch (error) {
      onError?.(`release-calendar FRED release ${releaseId}: ${errorMessage(error)}`);
      entries.push({
        label: group.name,
        indicatorIds: group.indicatorIds,
        nextReleaseDate: null,
        source: 'fred',
      });
    }
  }

  // FactSet: 通常は次の金曜日、休刊予告があればそちらを使う (resolveFactsetNextIssueDate)。
  const factsetIndicatorIds = Object.entries(indicators)
    .filter(([, indicator]) => indicator.source.adapter === 'factset-pdf')
    .map(([id]) => id);
  if (factsetIndicatorIds.length > 0) {
    let nextReleaseDate: string | null;
    try {
      nextReleaseDate = await resolveFactsetDate(now);
    } catch (error) {
      onError?.(`release-calendar FactSet: ${errorMessage(error)}`);
      nextReleaseDate = null;
    }
    entries.push({
      label: 'S&P 500 Earnings Insight (FactSet)',
      indicatorIds: factsetIndicatorIds,
      nextReleaseDate,
      source: 'factset',
    });
  }

  return { generatedAt: now.toISOString(), entries };
}
