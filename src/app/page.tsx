import { Suspense } from 'react';
import Link from 'next/link';
import { FairValueChart } from '@/components/charts/fair-value';
import { CorrelationSummary } from '@/components/charts/correlation-summary';
import { ForwardPeChart } from '@/components/charts/forward-pe';
import { ShillerPeChart } from '@/components/charts/shiller-pe';
import { IndexVsEpsChart } from '@/components/charts/index-vs-eps';
import { YieldSpreadChart } from '@/components/charts/yield-spread';
import { SummaryBar } from '@/components/summary-bar';
import { RevisionsChart } from '@/components/charts/revisions';
import { revisions, valuationView } from '@/lib/data/loader';

export default function ValuationPage() {
  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">バリュエーション</h1>
        {/* 初見のユーザー向けの導入 (#301)。アプリ全体の目的とページ構成を1画面で伝える。 */}
        <p className="text-sm text-slate-600 dark:text-slate-400">
          株式投資の判断に使う指標をまとめたサイト。S&amp;P 500 と NASDAQ-100 の割高・割安を見る
          <strong>バリュエーション</strong> (このページ) のほか、
          <strong>経済</strong>・<strong>市場</strong>・<strong>日本</strong>のページに分けている。
          先に全体の状況をつかみたいときは{' '}
          <Link href="/summary" className="underline">
            AI要約
          </Link>{' '}
          から見るとよい。
        </p>
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <SummaryBar view={valuationView} />

      {/* useSearchParams (期間フィルター) を使うため静的生成時は Suspense で包む。 */}
      <Suspense fallback={<div className="h-64 sm:h-80" />}>
        <IndexVsEpsChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-64 sm:h-80" />}>
        <ForwardPeChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-64 sm:h-80" />}>
        <ShillerPeChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-64 sm:h-80" />}>
        <YieldSpreadChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-96 sm:h-[28rem]" />}>
        <FairValueChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-64 sm:h-80" />}>
        <RevisionsChart revisions={revisions} />
      </Suspense>

      {/* 相関は期間フィルターに追従しないため Suspense 不要。 */}
      <CorrelationSummary view={valuationView} />

    </div>
  );
}
