/**
 * 画面が使うデータの読み込み。
 *
 * 静的エクスポート (ADR-0002) なので、生成済み JSON をビルド時に取り込む。
 * `store.ts` と違いファイルシステムを使わないため、クライアントからも安全に使える。
 *
 * 対象の JSON は週次バッチが生成してリポジトリにコミットするため、常に存在する。
 */
import changelogJson from '../../../data/changelog.json';
import statusJson from '../../../data/status.json';
import valuationJson from '../../../data/views/valuation.json';
import revisionsJson from '../../../data/views/revisions.json';
import macroJson from '../../../data/views/macro.json';
import marketDailyJson from '../../../data/views/market-daily.json';
import economyDailyJson from '../../../data/views/economy-daily.json';
import japanDailyJson from '../../../data/views/japan-daily.json';
import economyJson from '../../../data/views/economy.json';
import drawdownJson from '../../../data/views/drawdown.json';
import highTightFlagJson from '../../../data/views/high-tight-flag.json';
import { sortChangelog } from './changelog';
import type { DailyPoint } from './daily-series';
import type {
  BatchStatus,
  ChangelogEntry,
  DrawdownView,
  EconomyView,
  GapReason,
  HighTightFlagView,
  MacroPoint,
  RevisionPoint,
  ValuationView,
} from './types';

// JSON の型推論は実際の型より広いため、生成側の型で読み替える。
// 生成と読み込みは同じ型定義 (types.ts) を使うので、ずれたらビルドか実行時に気付ける。
export const status = statusJson as BatchStatus;
export const valuationView = valuationJson as unknown as ValuationView;
export const revisions = revisionsJson as unknown as RevisionPoint[];
export const macro = macroJson as unknown as MacroPoint[];
/**
 * 日次グリッドの系列 (#137)。**ページ別に分けてある** (#168)。
 *
 * ビュー JSON は import するとページに丸ごとインライン展開されるため、1 本にまとめると
 * 使わない系列まで運ぶ。どの系列がどのビューに属するかは `daily-series.ts` が唯一の定義。
 */
export const marketDaily = marketDailyJson as unknown as DailyPoint[];
export const economyDaily = economyDailyJson as unknown as DailyPoint[];
export const japanDaily = japanDailyJson as unknown as DailyPoint[];
export const economy = economyJson as unknown as EconomyView;
export const drawdown = drawdownJson as unknown as DrawdownView;
export const highTightFlag = highTightFlagJson as unknown as HighTightFlagView;
/** 更新履歴 (#240)。新しい順。 */
export const changelog = sortChangelog(changelogJson as unknown as ChangelogEntry[]);

/** データの鮮度。画面ヘッダーの表示に使う (screens N-1)。 */
export interface Freshness {
  lastSuccessAt: string | null;
  /** 最後に成功してからの日数。未成功なら null。 */
  daysSinceSuccess: number | null;
  /** 直近の欠測 (新しい順)。 */
  recentGaps: BatchStatus['recentGaps'];
  /**
   * 警告を出すべきか。
   * 週次更新なので、10 日を超えたら 1 回分の取得が落ちている可能性が高い。
   */
  isStale: boolean;
}

export function toFreshness(batchStatus: BatchStatus, now: Date): Freshness {
  if (batchStatus.lastSuccessAt === null) {
    return {
      lastSuccessAt: null,
      daysSinceSuccess: null,
      recentGaps: batchStatus.recentGaps,
      isStale: true,
    };
  }

  const elapsedMs = now.getTime() - new Date(batchStatus.lastSuccessAt).getTime();
  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

  return {
    lastSuccessAt: batchStatus.lastSuccessAt,
    daysSinceSuccess: days,
    recentGaps: batchStatus.recentGaps,
    isStale: days > 10,
  };
}

/** 欠測の理由を日本語にする。正常な欠測と要調査を区別して見せる (screens 共通の状態)。 */
export function describeGapReason(reason: GapReason): string {
  switch (reason) {
    case 'publication-break':
      return 'レポート休刊';
    case 'not-in-report':
      return 'この号に記載なし';
    case 'fetch-failed':
      return '取得失敗';
  }
}

/**
 * 調査が要る欠測か (#53)。
 *
 * 休刊と掲載無しはデータ提供元の仕様どおりで異常ではない。
 * これらを警告として出すと、本当に見るべき取得失敗が埋もれる。
 */
export function needsInvestigation(reason: GapReason): boolean {
  return reason === 'fetch-failed';
}

/** 直近の欠測を「理由ごとの件数」に畳む。ヘッダーで一覧を出すと長くなるため。 */
export function summarizeGaps(
  gaps: BatchStatus['recentGaps'],
): Array<{ date: string; reason: GapReason; count: number }> {
  const byKey = new Map<string, { date: string; reason: GapReason; count: number }>();
  for (const gap of gaps) {
    const key = `${gap.date}:${gap.reason}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, { date: gap.date, reason: gap.reason, count: 1 });
    } else {
      existing.count += 1;
    }
  }
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
}
