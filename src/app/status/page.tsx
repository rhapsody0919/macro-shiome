import Link from 'next/link';
import { indicatorStatus } from '@/lib/data/loader';
import { formatDate } from '@/lib/format';
import { IndicatorStatusTabs } from '@/components/indicator-status-tabs';

export const metadata = {
  title: '指標の取得状況 | macro-shiome',
};

/**
 * 指標ごとの取得状況ページ (#330)。
 *
 * チャートにマウスを当てなくても、指標ごとに取得できているかを確認できるようにする。
 * 「◯日空いたら異常」という閾値では判定しない (#52 と同じ判断)。直近の観測日を
 * そのまま並べ、間隔が普段と違うかを読み手が判断する。
 */
export default function StatusPage() {
  return (
    <article className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">指標の取得状況</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          指標ごとに、直近どの日の観測まで取れているかを頻度別に一覧できる。
          「◯日空いたら異常」という判定はしない。過去の間隔と比べて読み手が判断すること。
        </p>
        <p className="mt-1 text-xs text-slate-500">
          最終更新 {formatDate(indicatorStatus.generatedAt.slice(0, 10))}
        </p>
      </header>

      <IndicatorStatusTabs entries={indicatorStatus.entries} />

      <p className="text-sm">
        <Link href="/" className="underline">
          バリュエーション画面へ戻る
        </Link>
      </p>
    </article>
  );
}
