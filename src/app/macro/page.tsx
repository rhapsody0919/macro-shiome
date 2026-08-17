import { Suspense } from 'react';
import { MacroChart } from '@/components/charts/macro-chart';
import { macro } from '@/lib/data/loader';

export default function MacroPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-xl font-bold">マクロ指標</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          相場環境の周辺指標。すべて週次 (金曜時点) に揃えている。
        </p>
      </div>

      <Suspense fallback={<div className="h-64" />}>
        <MacroChart
          points={macro}
          title="金利の内訳"
          subtitle="名目 10 年債利回り・期待インフレ率・実質金利"
          kind="percent"
          series={[
            { key: 'nominalRate', label: '名目10年債', color: '#f97316' },
            { key: 'breakeven', label: '期待インフレ率', color: '#a855f7' },
            { key: 'realRate', label: '実質金利', color: '#0ea5e9' },
          ]}
          notes={[
            <span key="def">
              実質金利 = 名目 10 年債利回り − 期待インフレ率。イールドスプレッドの計算に使う値。
            </span>,
            <span key="why">
              名目が同じでも期待インフレ率が動けば実質金利は変わる。株式の相対的な魅力は実質金利で
              測るため、3 つを並べて構造を見る。
            </span>,
          ]}
        />
      </Suspense>

      <Suspense fallback={<div className="h-64" />}>
        <MacroChart
          points={macro}
          title="VIX"
          subtitle="S&P 500 のインプライド・ボラティリティ指数"
          series={[{ key: 'vix', label: 'VIX', color: '#ef4444' }]}
          notes={[
            <span key="weekly">
              週次 (金曜終値) のため、週の途中の急騰は平滑化される。日中の変動を追う用途には向かない。
            </span>,
            <span key="no-guide">
              水準の目安となる補助線は引いていない。閾値の置き方に定説が無く、恣意的な基準を
              示すことになるため。
            </span>,
          ]}
        />
      </Suspense>

      <Suspense fallback={<div className="h-64" />}>
        <MacroChart
          points={macro}
          title="USD/JPY"
          subtitle="円/ドル (FRB 公表値)"
          series={[{ key: 'usdjpy', label: 'USD/JPY', color: '#10b981' }]}
          notes={[
            <span key="weekly">週次 (金曜時点)。FRB が公表する日次値を金曜に揃えている。</span>,
          ]}
        />
      </Suspense>
    </div>
  );
}
