import { Suspense } from 'react';
import { ForwardPeChart } from '@/components/charts/forward-pe';
import { IndexVsEpsChart } from '@/components/charts/index-vs-eps';
import { YieldSpreadChart } from '@/components/charts/yield-spread';
import { valuationView } from '@/lib/data/loader';

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

      <p className="text-sm text-slate-500">
        理論値・相関・予想改定は Issue #16〜#19 で実装する。
      </p>
    </div>
  );
}
