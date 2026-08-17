import { Suspense, type ReactNode } from 'react';
import { MacroChart, type SeriesDef } from '@/components/charts/macro-chart';
import type { ValueKind } from '@/components/charts/chart-frame';
import { groupByCycle } from '@/lib/cycle';
import { indicators } from '@/lib/data/indicators';
import { macro } from '@/lib/data/loader';
import type { CyclePosition } from '@/lib/data/types';

/**
 * マクロ画面のチャート定義 (#62)。
 *
 * **セクション分けの根拠は指標マスタが持つ** (`cyclePosition`)。ここでは
 * 「このチャートを代表する指標」だけを指し、分類はそこから引く。
 * 画面に分類を書くと、指標を足すたびに 2 か所を直すことになる。
 */
interface MacroChartDef {
  /** 分類の引き元。複数指標を束ねるチャートは主となる指標を指す。 */
  primaryIndicator: string;
  title: string;
  subtitle: string;
  kind?: ValueKind;
  series: SeriesDef[];
  notes: ReactNode[];
}

const CHARTS: MacroChartDef[] = [
  {
    primaryIndicator: 'dgs10',
    title: '金利の内訳',
    subtitle: '名目 10 年債利回り・期待インフレ率・実質金利',
    kind: 'percent',
    series: [
      { key: 'nominalRate', label: '名目10年債', color: '#f97316' },
      { key: 'breakeven', label: '期待インフレ率', color: '#a855f7' },
      { key: 'realRate', label: '実質金利', color: '#0ea5e9' },
    ],
    notes: [
      <span key="def">
        実質金利 = 名目 10 年債利回り − 期待インフレ率。イールドスプレッドの計算に使う値。
      </span>,
      <span key="why">
        名目が同じでも期待インフレ率が動けば実質金利は変わる。株式の相対的な魅力は実質金利で
        測るため、3 つを並べて構造を見る。
      </span>,
    ],
  },
  {
    primaryIndicator: 'vix',
    title: 'VIX',
    subtitle: 'S&P 500 のインプライド・ボラティリティ指数',
    series: [{ key: 'vix', label: 'VIX', color: '#ef4444' }],
    notes: [
      <span key="weekly">
        週次 (金曜終値) のため、週の途中の急騰は平滑化される。日中の変動を追う用途には向かない。
      </span>,
      <span key="no-guide">
        水準の目安となる補助線は引いていない。閾値の置き方に定説が無く、恣意的な基準を
        示すことになるため。
      </span>,
    ],
  },
  {
    primaryIndicator: 'usdjpy',
    title: 'USD/JPY',
    subtitle: '円/ドル (FRB 公表値)',
    series: [{ key: 'usdjpy', label: 'USD/JPY', color: '#10b981' }],
    notes: [
      <span key="weekly">週次 (金曜時点)。FRB が公表する日次値を金曜に揃えている。</span>,
    ],
  },
];

/**
 * 分類を指標マスタから引く。
 *
 * **未知の ID はエラーにする**。黙って「その他」に落とすと、指標マスタから消えた指標を
 * 画面が指し続けても気付けない。静的生成なのでビルド時に落ちる。
 */
function positionOf(chart: MacroChartDef): CyclePosition | undefined {
  const indicator = indicators[chart.primaryIndicator];
  if (indicator === undefined) {
    throw new Error(
      `マクロ画面: 指標マスタに無い ID を参照している (${chart.primaryIndicator})`,
    );
  }
  return indicator.cyclePosition;
}

export default function MacroPage() {
  // 空のセクションは出さない。指標が増えれば自動で現れる。
  const groups = groupByCycle(CHARTS, positionOf);

  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-xl font-bold">マクロ指標</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          相場環境の周辺指標。すべて週次 (金曜時点) に揃えている。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          景気サイクルに対する位置で並べている。分類は
          <strong> The Conference Board の景気指数の構成要素</strong>
          に従い、当てはまらない指標は分類しない (根拠の無い先行性を示さないため)。
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.section} className="space-y-8">
          <header className="border-b border-slate-200 pb-2 dark:border-slate-800">
            <h2 className="text-lg font-bold">{group.meta.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{group.meta.description}</p>
          </header>

          {group.items.map((chart) => (
            <Suspense key={chart.title} fallback={<div className="h-64" />}>
              <MacroChart
                points={macro}
                title={chart.title}
                subtitle={chart.subtitle}
                kind={chart.kind}
                series={chart.series}
                notes={chart.notes}
              />
            </Suspense>
          ))}
        </section>
      ))}
    </div>
  );
}
