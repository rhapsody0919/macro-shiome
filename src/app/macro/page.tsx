import { Suspense, type ReactNode } from 'react';
import { MacroChart, type SeriesDef } from '@/components/charts/macro-chart';
import { MacroSummary } from '@/components/macro-summary';
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
  /** 符号が意味を持つ指標か。ゼロ線を引き負の領域を塗る。 */
  signed?: boolean;
  series: SeriesDef[];
  notes: ReactNode[];
}

const CHARTS: MacroChartDef[] = [
  {
    primaryIndicator: 't10y2y',
    title: 'イールドカーブ (10年債 − 2年債)',
    subtitle: '長短金利差。負なら逆イールド',
    kind: 'percent',
    signed: true,
    series: [{ key: 'termSpread', label: '10年 − 2年', color: '#6366f1' }],
    notes: [
      <span key="vs-spread">
        <strong>イールドスプレッド (バリュエーション画面) とは別物。</strong>
        あちらは株式益回り − 実質金利で株式と債券の相対的な魅力を見る。こちらは長短金利の傾き。
      </span>,
      <span key="meaning">
        通常は長期金利が短期金利を上回る (順イールド)。
        <strong>負になると逆イールド</strong>で、市場が将来の利下げ = 景気減速を織り込んでいる状態。
        赤い領域が逆イールドの範囲。
      </span>,
      <span key="caution">
        <strong>「逆イールド = 景気後退」と断定はできない。</strong>
        過去に先行指標として機能した例が多いものの、実際の景気後退までの時間差は数か月〜2 年と幅があり、
        外れた事例もある。The Conference Board の景気先行指数の構成要素は「10 年債 − FF 金利」で、
        本指標とは厳密には別系列。
      </span>,
      <span key="daily">週次 (金曜時点)。FRED が公表する日次値を金曜に揃えている。</span>,
    ],
  },
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
    primaryIndicator: 'mortgage-rate-30y',
    title: '住宅ローン金利 (30年固定)',
    subtitle: '住宅需要の背景要因',
    kind: 'percent',
    series: [{ key: 'mortgageRate', label: '30年固定金利', color: '#ec4899' }],
    notes: [
      <span key="why">
        住宅市場の連鎖 (金利 → 申請 → 建設許可 → 着工 → 販売) の起点にあたる。
        許可・着工・販売は月次のため<strong>経済統計のページ</strong>に置いている。
      </span>,
      <span key="mba">
        <strong>住宅ローン申請者数 (MBA) の代替。</strong>
        本来はこれが最も先行性の高いデータだが、ライセンス制で無料取得できない。
        金利は申請の背景要因であり、<strong>申請そのものより先行性は落ちる</strong>。
      </span>,
      <span key="copyright">
        著作権は Freddie Mac にある。週次 (木曜発表) の値を金曜時点に揃えている。
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
        {/* 説明は 1 行に絞る。分類の根拠は各セクションの見出し下にある (#75)。 */}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          相場環境の週次指標。景気サイクルに対する位置で並べている。
        </p>
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <MacroSummary points={macro} />

      {groups.map((group) => (
        <section key={group.section} className="space-y-8">
          <header className="border-b border-slate-200 pb-2 dark:border-slate-800">
            <h2 className="text-lg font-bold">{group.meta.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{group.meta.description}</p>
          </header>

          {group.items.map((chart) => (
            <Suspense key={chart.title} fallback={<div className="h-56 sm:h-64" />}>
              <MacroChart
                points={macro}
                title={chart.title}
                subtitle={chart.subtitle}
                kind={chart.kind}
                signed={chart.signed}
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
