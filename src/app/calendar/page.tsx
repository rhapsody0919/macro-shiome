import Link from 'next/link';
import { releaseCalendar } from '@/lib/data/loader';
import { indicators } from '@/lib/data/indicators';
import { formatDate } from '@/lib/format';

export const metadata = {
  title: '発表予定カレンダー | macro-shiome',
};

const SOURCE_LABELS = {
  fred: 'FRED',
  factset: 'FactSet',
} as const;

/**
 * 指標の発表予定カレンダー (#270)。
 *
 * 「次はいつ更新されるか」がヘッダーの鮮度バッジ (過去の実績) からは分からず、
 * バッチが壊れていると誤解される余地があったための対応。
 *
 * **対象は FRED と FactSet 由来の指標のみ。** 財務省の入札予定・統計ダッシュボードの
 * 公表予定は取得経路を確認できていないため対象外 (#270 の調査で保留、恣意的な除外ではない)。
 */
export default function CalendarPage() {
  const sorted = [...releaseCalendar.entries].sort((a, b) => {
    if (a.nextReleaseDate === null) return 1;
    if (b.nextReleaseDate === null) return -1;
    return a.nextReleaseDate.localeCompare(b.nextReleaseDate);
  });

  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-bold">発表予定カレンダー</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          指標の次回発表予定日。過去の取得実績はヘッダーの鮮度表示を見る。
        </p>
        <p className="mt-1 text-xs text-slate-500">
          対象は FRED・FactSet 由来の指標のみ。それ以外のデータソースの発表予定は
          未確認のため一覧に含めていない。
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">まだ生成されていない。</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((entry) => (
            <li
              key={entry.label}
              className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{entry.label}</span>
                <span className="text-xs text-slate-500">{SOURCE_LABELS[entry.source]}</span>
              </div>
              <div className="mt-1 text-sm">
                次回:{' '}
                <span className="font-semibold tabular-nums">
                  {entry.nextReleaseDate === null ? '不明' : formatDate(entry.nextReleaseDate)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {entry.indicatorIds
                  .map((id) => indicators[id]?.name ?? id)
                  .join(' / ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        最終更新 {formatDate(releaseCalendar.generatedAt.slice(0, 10))}
      </p>

      <p className="text-sm">
        <Link href="/" className="underline">
          バリュエーション画面へ戻る
        </Link>
      </p>
    </article>
  );
}
