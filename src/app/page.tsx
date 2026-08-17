import { Suspense } from 'react';
import { FairValueChart } from '@/components/charts/fair-value';
import { CorrelationSummary } from '@/components/charts/correlation-summary';
import { ForwardPeChart } from '@/components/charts/forward-pe';
import { IndexVsEpsChart } from '@/components/charts/index-vs-eps';
import { YieldSpreadChart } from '@/components/charts/yield-spread';
import { RevisionsChart } from '@/components/charts/revisions';
import { revisions, valuationView } from '@/lib/data/loader';

export default function ValuationPage() {
  return (
    <div className="space-y-12">
      <h1 className="text-xl font-bold">バリュエーション</h1>

      {/* useSearchParams (期間フィルター) を使うため静的生成時は Suspense で包む。 */}
      <Suspense fallback={<div className="h-80" />}>
        <IndexVsEpsChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-80" />}>
        <ForwardPeChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-80" />}>
        <YieldSpreadChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-[28rem]" />}>
        <FairValueChart view={valuationView} />
      </Suspense>

      <Suspense fallback={<div className="h-80" />}>
        <RevisionsChart revisions={revisions} />
      </Suspense>

      {/* 相関は期間フィルターに追従しないため Suspense 不要。 */}
      <CorrelationSummary view={valuationView} />

      <p className="text-sm text-slate-500">サマリーバーは Issue #19 で実装する。</p>
    </div>
  );
}
