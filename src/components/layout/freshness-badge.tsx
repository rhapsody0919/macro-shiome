import {
  describeGapReason,
  needsInvestigation,
  summarizeGaps,
  type Freshness,
} from '@/lib/data/loader';

/**
 * データの鮮度表示 (screens N-1)。
 *
 * 週次更新なので「いつのデータか」が分からないと判断を誤る。
 * 古いデータを最新と誤認させないことが目的。
 */
export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const gaps = summarizeGaps(freshness.recentGaps).slice(0, 3);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className={freshness.isStale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
        {freshness.lastSuccessAt === null ? (
          // 一度も成功していない状態。初回デプロイ直後に起こりうる。
          <>データ未取得</>
        ) : (
          <>
            最終更新 {formatDate(freshness.lastSuccessAt)}
            {freshness.daysSinceSuccess !== null && freshness.daysSinceSuccess > 0 && (
              <span className="ml-1">({freshness.daysSinceSuccess}日前)</span>
            )}
          </>
        )}
      </span>

      {freshness.isStale && (
        // 色だけに頼らず記号と文言でも示す (screens UI/UX 方針 3)。
        <span className="text-amber-600 dark:text-amber-400">
          ⚠ 更新が滞っている可能性がある
        </span>
      )}

      {gaps.length > 0 && (
        <span className="text-slate-500">
          直近の欠測:{' '}
          {gaps.map((gap, i) => (
            <span
              key={`${gap.date}-${gap.reason}`}
              // 要調査の欠測だけを目立たせる。休刊・掲載無しは仕様どおりの状態で、
              // 同じ見た目にすると本当に見るべき取得失敗が埋もれる (#53)。
              className={
                needsInvestigation(gap.reason) ? 'text-amber-600 dark:text-amber-400' : undefined
              }
            >
              {i > 0 && ' / '}
              {formatDate(gap.date)} {describeGapReason(gap.reason)}
              {gap.count > 1 && ` ×${gap.count}`}
              {needsInvestigation(gap.reason) && ' ⚠'}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** "YYYY-MM-DD" または ISO 8601 を "YYYY/MM/DD" にする。 */
function formatDate(value: string): string {
  return value.slice(0, 10).replace(/-/g, '/');
}
