import { Suspense, type ReactNode } from 'react';
import { MonthlyChart, type MonthlySeriesDef } from '@/components/charts/monthly-chart';
import { EconomySummary } from '@/components/economy-summary';
import { COLORS } from '@/lib/colors';
import { groupByCycle } from '@/lib/cycle';
import { indicators } from '@/lib/data/indicators';
import { economy } from '@/lib/data/loader';
import type { CyclePosition } from '@/lib/data/types';

export const metadata = {
  title: '経済統計 | macro-shiome',
};

/**
 * 経済統計 (月次) のチャート定義 (#64 / #66)。
 *
 * セクション分けの根拠は指標マスタが持つ (`cyclePosition`)。ここでは
 * 「このチャートを代表する指標」だけを指す。
 */
interface MonthlyChartDef {
  primaryIndicator: string;
  title: string;
  subtitle: string;
  kind?: 'percent' | 'number';
  zeroLine?: boolean;
  series: MonthlySeriesDef[];
  notes: ReactNode[];
}

const CHARTS: MonthlyChartDef[] = [
  {
    // 建設許可は The Conference Board の景気先行指数 (LEI) の構成要素。
    primaryIndicator: 'building-permits',
    title: '住宅市場',
    subtitle: '建設許可 → 着工 → 新築販売 (千戸・季節調整済み年率)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'buildingPermits',
        label: '建設許可',
        color: COLORS.buildingPermits,
        width: 2.4,
        indicatorId: 'building-permits',
      },
      { key: 'housingStarts', label: '着工', color: COLORS.housingStarts, indicatorId: 'housing-starts' },
      { key: 'newHomeSales', label: '新築販売', color: COLORS.newHomeSales, indicatorId: 'new-home-sales' },
    ],
    notes: [
      <span key="chain">
        <strong>住宅は連鎖で動く。</strong>
        建設許可 → 着工 → 販売の順に進むため、上流の建設許可が最も早く変化を示す。
        The Conference Board の景気先行指数の構成要素でもある。
      </span>,
      <span key="mortgage">
        さらに上流にあるのが<strong>住宅ローン金利</strong>で、これは週次のため
        マクロ指標のページに置いている。金利上昇 → 申請減少 → 許可・着工減少、と伝わる。
      </span>,
      <span key="mba">
        <strong>住宅ローン申請者数 (MBA) は無料で取得できない</strong>ため表示していない。
        本来はこれが最も先行性の高いデータだが、ライセンス制で FRED に収録されていない。
        住宅ローン金利で代替しており、<strong>申請そのものより先行性は落ちる</strong>。
      </span>,
      <span key="unit">
        いずれも千戸・季節調整済み年率。単位が揃っているため水準のまま並べている。
      </span>,
    ],
  },
  {
    // 非農業部門雇用者数は景気一致指数 (CEI) の構成要素。
    primaryIndicator: 'payrolls',
    title: '労働市場',
    subtitle: '雇用者数の前年同月比 (3 つの捉え方)',
    series: [
      {
        key: 'payrolls',
        label: '非農業部門雇用者数',
        color: COLORS.payrolls,
        width: 2.4,
        indicatorId: 'payrolls',
      },
      {
        key: 'employmentLevel',
        label: '就業者数 (自営業含む)',
        color: COLORS.employmentLevel,
        indicatorId: 'employment-level',
      },
      {
        key: 'fullTimeEmployment',
        label: 'フルタイム',
        color: COLORS.fullTimeEmployment,
        indicatorId: 'full-time-employment',
      },
    ],
    notes: [
      <span key="diff">
        <strong>3 つは調査方法が違う。</strong>
        ニュースで報じられる「雇用統計」は<strong>非農業部門雇用者数</strong> (事業所調査) で、
        <strong>自営業者と農業従事者を含まない</strong>。就業者数 (家計調査) はそれらを含むため、
        働いている人の総数に近い。フルタイムは雇用の質を見る。
      </span>,
      <span key="coincident">
        <strong>雇用は「先行」ではなく「一致」指標。</strong>
        The Conference Board は非農業部門雇用者数を景気一致指数の構成要素としている。
        悪化が見えた時点で、既に景気が転換している可能性がある。
      </span>,
      <span key="yoy">
        前年同月比で揃えている。水準 (千人) は 3 系列で桁が違い、変化の大きさが比べられないため。
      </span>,
    ],
  },
  {
    // 移転所得を除く実質個人所得は景気一致指数 (CEI) の構成要素。
    primaryIndicator: 'real-income-ex-transfer',
    title: '実質所得',
    subtitle: '個人消費の源泉となる所得の前年同月比',
    series: [
      {
        key: 'realIncomeExTransfer',
        label: '実質個人所得 (移転所得を除く)',
        color: COLORS.realIncomeExTransfer,
        width: 2.4,
        indicatorId: 'real-income-ex-transfer',
      },
      {
        key: 'realDisposablePerCapita',
        label: '1人当たり実質可処分所得',
        color: COLORS.realDisposablePerCapita,
        indicatorId: 'real-disposable-income-per-capita',
      },
    ],
    notes: [
      <span key="ex-transfer">
        <strong>移転所得を除く</strong>とは、年金など政府からの給付を差し引いた
        <strong>民間の経済活動による所得</strong>のこと。景気一致指数の構成要素。
      </span>,
      <span key="per-capita">
        <strong>1 人当たりで見る理由:</strong> 米国は人口が増え続けるため、全体の所得が
        横ばいでも 1 人当たりでは減っていることがある。
      </span>,
      <span key="real">
        いずれも実質値 (物価変動を除いた値)。名目では物価上昇分だけ増えて見える。
      </span>,
    ],
  },
  {
    primaryIndicator: 'savings-rate',
    title: '貯蓄率',
    subtitle: '可処分所得のうち貯蓄に回る割合 (水準)',
    kind: 'number',
    zeroLine: false,
    series: [
      { key: 'savingsRate', label: '貯蓄率 (%)', color: COLORS.savingsRate, indicatorId: 'savings-rate' },
    ],
    notes: [
      <span key="meaning">
        低下は<strong>貯蓄を取り崩して消費している</strong>ことを示す。所得が伸びなくても
        消費を維持できるが、取り崩しには限界がある。
      </span>,
      <span key="no-threshold">
        <strong>危険水準の線は引いていない。</strong>
        「◯% を下回ったら危険」という基準には定説が無く、恣意的になるため
        (イールドスプレッドと同じ判断)。過去の水準と比べて読むこと。
      </span>,
      <span key="level">水準そのものが意味を持つため、前年同月比には変換していない。</span>,
    ],
  },
  {
    primaryIndicator: 'consumer-sentiment',
    title: '消費者信頼感',
    subtitle: 'ミシガン大学消費者信頼感指数 (1966年Q1 = 100)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'consumerSentiment',
        label: '消費者信頼感指数',
        color: COLORS.consumerSentiment,
        indicatorId: 'consumer-sentiment',
      },
    ],
    notes: [
      <span key="survey">
        意識調査であり実際の消費データではない。個人消費の先行きと連動性があるとされる。
      </span>,
      <span key="copyright">
        <strong>著作権は University of Michigan にある。</strong>
      </span>,
    ],
  },
  {
    primaryIndicator: 'import-price',
    title: '物価の連鎖',
    subtitle: '輸入物価 → 生産者物価 → CPI / PCE (すべて前年同月比)',
    series: [
      { key: 'importPrice', label: '輸入物価', color: COLORS.importPrice, width: 2.4, indicatorId: 'import-price' },
      { key: 'producerPrice', label: '生産者物価', color: COLORS.producerPrice, indicatorId: 'producer-price' },
      { key: 'cpi', label: 'CPI', color: COLORS.cpi, indicatorId: 'cpi' },
      { key: 'pce', label: 'PCE', color: COLORS.pce, indicatorId: 'pce-price' },
    ],
    notes: [
      <span key="reading">
        <strong>読み方:</strong> 輸入物価は企業の仕入れ価格にあたり、物価の起点になる。
        上流 (輸入物価) の変化が生産者物価に転嫁され、さらに CPI / PCE に及ぶまでには
        <strong>時間差がある</strong>。上流が上を向いた時点で、下流の上昇余地が残っていると読める。
      </span>,
      <span key="yoy">
        <strong>前年同月比で揃えている。</strong>
        指標ごとに基準年が違う (輸入物価 2000=100 / 生産者物価 Nov 2009=100 / CPI 1982-84=100 /
        PCE 2017=100) ため、水準を並べても比較にならない。
      </span>,
      <span key="sa">
        季節調整は輸入物価のみ無し、他は調整済み。前年同月比では季節性がおおむね相殺されるが、
        厳密には同一条件ではない。PCE は FRB が最も重視するインフレ指標。
      </span>,
    ],
  },
];

/** 分類を指標マスタから引く。未知の ID はビルド時にエラーにする。 */
function positionOf(chart: MonthlyChartDef): CyclePosition | undefined {
  const indicator = indicators[chart.primaryIndicator];
  if (indicator === undefined) {
    throw new Error(`経済統計画面: 指標マスタに無い ID を参照している (${chart.primaryIndicator})`);
  }
  return indicator.cyclePosition;
}

/**
 * 経済統計 (月次) の画面 (#64 / #66)。
 *
 * **市場データ (`/macro`) と分けている。** 更新頻度が違うため。
 * 週次の市場データは毎週動くが、経済統計は月 1 回しか動かない。同じページに置くと
 * 「先週から動いていない」のか「月次だから動かない」のか読み手が判別できない。
 */
export default function EconomyPage() {
  const groups = groupByCycle(CHARTS, positionOf);

  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-xl font-bold">経済統計</h1>
        {/*
          説明は 1 行に絞る。詳細 (発表ラグ・分類の根拠) は各チャートの注記にあり、
          冒頭で繰り返すとモバイルの 1 画面目が文字だけになる (#75)。
        */}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          月次で発表される経済指標。<strong>横軸は対象月</strong> (発表日ではない)。
        </p>
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <EconomySummary points={economy.monthly} />

      {groups.map((group) => (
        <section key={group.section} className="space-y-10">
          <header className="border-b border-slate-200 pb-2 dark:border-slate-800">
            <h2 className="text-lg font-bold">{group.meta.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{group.meta.description}</p>
          </header>

          {/* useSearchParams (期間フィルター) を使うため静的生成時は Suspense で包む。 */}
          {group.items.map((chart) => (
            <Suspense key={chart.title} fallback={<div className="h-72 sm:h-96" />}>
              <MonthlyChart
                view={economy}
                title={chart.title}
                subtitle={chart.subtitle}
                kind={chart.kind}
                zeroLine={chart.zeroLine}
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
