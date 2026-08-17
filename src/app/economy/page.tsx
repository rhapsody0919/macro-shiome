import { EconomySummary } from '@/components/economy-summary';
import {
  QuestionIndex,
  QuestionSections,
  type QuestionChartDef,
} from '@/components/charts/question-sections';
import { COLORS } from '@/lib/colors';
import { economy, macro } from '@/lib/data/loader';
import { ECONOMY_QUESTIONS, type EconomyQuestionId } from '@/lib/questions';

export const metadata = {
  title: '経済 | macro-shiome',
};

/**
 * 経済ページのチャート定義 (#89)。
 *
 * 並びは**問いごとに上流 → 下流**。求人・受注のような上流が先に動き、
 * 生産・雇用は後から追う。順序そのものが読み方になっている。
 */
const CHARTS: QuestionChartDef<EconomyQuestionId>[] = [
  {
    question: 'slowdown',
    frequency: 'weekly',
    primaryIndicator: 'new-job-postings',
    title: '新規求人 (Indeed)',
    subtitle: '新規に掲載された求人。2020年2月1日 = 100',
    baseline: { value: 100, label: '2020年2月 = 100' },
    series: [{ key: 'newJobPostings', label: '新規求人', color: COLORS.newJobPostings }],
    notes: [
      <span key="leading">
        参考記事が<strong>労働市場で最も先行性のあるデータ</strong>として使っている。
        企業は採用を止めるとまず求人の掲載を減らすため、雇用者数の変化より早く動く。
      </span>,
      <span key="baseline">
        <strong>破線はコロナ前 (2020年2月1日) の水準。</strong>
        指数の定義上の基準であり、恣意的に置いた線ではない。
        参考記事はこれを下回った状態が続くと雇用者数が減少に転じる目安としている
        (ただし<strong>その目安自体は記事の見立て</strong>で、公式の基準ではない)。
      </span>,
      <span key="vs-total">
        <strong>総求人とは別の系列。</strong>
        こちらは新規に掲載された分だけを数えるため、募集が続いている求人は含まない。
        公式統計の求人件数 (JOLTS) は<strong>次の問い</strong>に置いている。
      </span>,
      <span key="copyright">著作権は Indeed にある。日次を金曜時点に揃えている。</span>,
    ],
  },
  {
    question: 'slowdown',
    frequency: 'weekly',
    primaryIndicator: 'initial-claims',
    title: '新規失業保険申請件数',
    subtitle: '労働市場の悪化を最も早く捉える (週次)',
    series: [{ key: 'initialClaims', label: '申請件数', color: COLORS.initialClaims }],
    notes: [
      <span key="direction">
        <strong>増加が悪化を意味する。</strong>
        他の指標と向きが逆なので読み違えないこと。解雇が増えると申請が先に増える。
      </span>,
      <span key="leading">
        The Conference Board の景気先行指数 (LEI) の構成要素。
        <strong>雇用統計 (一致指標) より早く動く</strong>ため、労働市場の転換を先に捉えられる。
      </span>,
      <span key="weekly">
        週次で発表される数少ない指標。月次の雇用統計を待たずに傾向が分かる。
        ここでは金曜時点の値に揃えている。
      </span>,
    ],
  },
  {
    // 週平均労働時間は The Conference Board の景気先行指数 (LEI) の構成要素。
    question: 'slowdown',
    frequency: 'monthly',
    primaryIndicator: 'manufacturing-hours',
    title: '製造業の週平均労働時間',
    subtitle: '残業の増減が雇用より先に動く (時間)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'manufacturingHours',
        label: '週平均労働時間',
        color: COLORS.manufacturingHours,
        indicatorId: 'manufacturing-hours',
      },
    ],
    notes: [
      <span key="why">
        <strong>企業は解雇の前に残業を減らす。</strong>
        需要が落ちるとまず労働時間が短くなり、雇用者数の減少はその後に来る。
        The Conference Board の景気先行指数 (LEI) の構成要素。
      </span>,
      <span key="level">
        水準そのものが意味を持つ (週 40 時間が目安) ため、前年同月比には変換していない。
        変化幅は小さいが、<strong>0.1 時間の差でも景気局面では意味がある</strong>。
      </span>,
    ],
  },
  {
    // 新規受注 2 系列は The Conference Board の景気先行指数 (LEI) の構成要素。
    question: 'slowdown',
    frequency: 'monthly',
    primaryIndicator: 'new-orders-consumer-goods',
    title: '製造業の新規受注',
    subtitle: '消費財と設備投資の受注の前年同月比',
    series: [
      {
        key: 'newOrdersConsumerGoods',
        label: '消費財',
        color: COLORS.newOrdersConsumerGoods,
        width: 2.4,
        indicatorId: 'new-orders-consumer-goods',
      },
      {
        key: 'newOrdersCapitalGoods',
        label: '非国防資本財 (航空機を除く)',
        color: COLORS.newOrdersCapitalGoods,
        indicatorId: 'new-orders-capital-goods',
      },
    ],
    notes: [
      <span key="leading">
        どちらも The Conference Board の景気先行指数 (LEI) の構成要素。
        <strong>受注は生産・出荷より前の段階</strong>なので、需要の変化が先に現れる。
      </span>,
      <span key="ism">
        <strong>ISM 新規受注指数は表示していない。</strong>
        LEI の構成要素だが ISM に著作権があり、FRED に収録されていない。
        同じ「新規受注」を捉えるこの 2 系列で代替している。
      </span>,
      <span key="capital">
        非国防資本財 (航空機を除く) は<strong>企業の設備投資意欲</strong>の代表指標。
        航空機は 1 件が巨額で振れが大きいため除く。
      </span>,
    ],
  },
  {
    // 鉱工業生産は景気一致指数 (CEI) の構成要素。
    question: 'slowdown',
    frequency: 'monthly',
    primaryIndicator: 'industrial-production',
    title: '鉱工業生産',
    subtitle: '生産量の前年同月比',
    series: [
      {
        key: 'industrialProduction',
        label: '鉱工業生産指数',
        color: COLORS.industrialProduction,
        indicatorId: 'industrial-production',
      },
    ],
    notes: [
      <span key="coincident">
        The Conference Board の景気一致指数 (CEI) の構成要素。
        <strong>先行指標ではない</strong>ので、悪化が見えた時点で既に転換している可能性がある。
        このセクションの最後に置いているのはそのため。
      </span>,
      <span key="scope">
        製造業・鉱業・電気ガスの生産量を指数化したもの。サービス業は含まない。
      </span>,
    ],
  },
  {
    // 非農業部門雇用者数は景気一致指数 (CEI) の構成要素。
    question: 'labor',
    frequency: 'monthly',
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
    question: 'labor',
    frequency: 'monthly',
    primaryIndicator: 'job-openings',
    title: '求人件数 (JOLTS)',
    subtitle: '労働省の公式統計 (千件)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'jobOpenings',
        label: '求人件数',
        color: COLORS.jobOpenings,
        indicatorId: 'job-openings',
      },
    ],
    notes: [
      <span key="official">
        調査に基づく公式統計。<strong>Indeed の新規求人より発表が 2 か月ほど遅い</strong>が、
        水準の基準になる。速報性を求めるなら「景気は減速しているか」の新規求人を見る。
      </span>,
      <span key="meaning">求人が減ると採用が細り、やがて雇用者数の減少につながる。</span>,
    ],
  },
  {
    question: 'labor',
    frequency: 'monthly',
    primaryIndicator: 'unemployment-rate',
    title: '失業率',
    subtitle: '労働力人口に占める失業者の割合 (水準)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'unemploymentRate',
        label: '失業率 (%)',
        color: COLORS.unemploymentRate,
        indicatorId: 'unemployment-rate',
      },
    ],
    notes: [
      <span key="lagging">
        最も広く見られる労働市場の指標だが、<strong>景気の転換には遅れて動く</strong>。
        企業は採用を止め、残業を減らし、それでも足りなければ解雇するという順序で動くため。
        より早く動くのは<strong>週平均労働時間</strong>と<strong>新規失業保険申請</strong>で、
        どちらも「景気は減速しているか」に置いている。
      </span>,
      <span key="not-lag-component">
        The Conference Board の景気遅行指数の構成要素は「平均失業期間」であり
        失業率そのものではないため、分類していない。
      </span>,
    ],
  },
  {
    // 移転所得を除く実質個人所得は景気一致指数 (CEI) の構成要素。
    question: 'labor',
    frequency: 'monthly',
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
    question: 'consumption',
    frequency: 'monthly',
    primaryIndicator: 'retail-sales-core',
    title: '小売売上',
    subtitle: '自動車・ガソリンを除く小売売上の前年同月比',
    series: [
      {
        key: 'retailSales',
        label: '小売売上 (自動車・ガソリン除く)',
        color: COLORS.retailSales,
        width: 2.4,
        indicatorId: 'retail-sales-core',
      },
    ],
    notes: [
      <span key="not-control">
        <strong>「コントロールグループ」ではない。</strong>
        参考記事が使うコントロールグループは自動車・ガソリンに加えて
        <strong>建材と外食も除く</strong>が、FRED にその系列は存在しない
        (Advance Retail Sales の Excluding 系列は 3 種類のみ)。ここでは最も近い公式系列を使っている。
      </span>,
      <span key="no-derive">
        <strong>引き算で導出はしない。</strong>
        季節調整は系列ごとに行われるため、季節調整済みの値を差し引いても
        公式のコントロールグループとは一致しない。
      </span>,
      <span key="why-exclude">
        自動車とガソリンを除くのは、価格や販売台数の変動が大きく消費の基調が見えにくいため。
      </span>,
    ],
  },
  {
    question: 'consumption',
    frequency: 'monthly',
    primaryIndicator: 'savings-rate',
    title: '貯蓄率',
    subtitle: '可処分所得のうち貯蓄に回る割合 (水準)',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'savingsRate',
        label: '貯蓄率 (%)',
        color: COLORS.savingsRate,
        indicatorId: 'savings-rate',
      },
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
    question: 'consumption',
    frequency: 'monthly',
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
    question: 'prices',
    frequency: 'weekly',
    primaryIndicator: 'wti',
    title: '原油価格 (WTI)',
    subtitle: 'ドル/バレル',
    series: [{ key: 'wti', label: 'WTI', color: COLORS.wti }],
    notes: [
      <span key="chain">
        <strong>物価の起点。</strong>
        エネルギーコストは輸入物価・生産者物価を通じて CPI に波及する。次の図がその連鎖。
      </span>,
      <span key="weekly">
        週次 (金曜時点)。<strong>この問いで唯一の週次指標</strong>で、物価の変化を最も早く示す。
      </span>,
    ],
  },
  {
    question: 'prices',
    frequency: 'monthly',
    primaryIndicator: 'import-price',
    title: '物価の連鎖',
    subtitle: '輸入物価 → 生産者物価 → CPI / PCE (すべて前年同月比)',
    series: [
      {
        key: 'importPrice',
        label: '輸入物価',
        color: COLORS.importPrice,
        width: 2.4,
        indicatorId: 'import-price',
      },
      {
        key: 'producerPrice',
        label: '生産者物価',
        color: COLORS.producerPrice,
        indicatorId: 'producer-price',
      },
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
  {
    question: 'housing',
    frequency: 'weekly',
    primaryIndicator: 'mortgage-rate-30y',
    title: '住宅ローン金利 (30年固定)',
    subtitle: '住宅需要の背景要因',
    kind: 'percent',
    series: [{ key: 'mortgageRate', label: '30年固定金利', color: COLORS.mortgageRate }],
    notes: [
      <span key="why">
        住宅市場の連鎖 (金利 → 申請 → 建設許可 → 着工 → 販売) の起点にあたる。次の図がその先。
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
    // 建設許可は The Conference Board の景気先行指数 (LEI) の構成要素。
    question: 'housing',
    frequency: 'monthly',
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
      {
        key: 'housingStarts',
        label: '着工',
        color: COLORS.housingStarts,
        indicatorId: 'housing-starts',
      },
      {
        key: 'newHomeSales',
        label: '新築販売',
        color: COLORS.newHomeSales,
        indicatorId: 'new-home-sales',
      },
    ],
    notes: [
      <span key="chain">
        <strong>住宅は連鎖で動く。</strong>
        建設許可 → 着工 → 販売の順に進むため、上流の建設許可が最も早く変化を示す。
        The Conference Board の景気先行指数の構成要素でもある。
      </span>,
      <span key="mba">
        <strong>住宅ローン申請者数 (MBA) は無料で取得できない</strong>ため表示していない。
        本来は金利と許可の間に入る最も先行性の高いデータだが、ライセンス制で FRED に収録されていない。
      </span>,
      <span key="unit">
        いずれも千戸・季節調整済み年率。単位が揃っているため水準のまま並べている。
      </span>,
    ],
  },
];

/**
 * 経済ページ (#89)。
 *
 * **セクションは「問い」で分ける。** 「先行指標」という見出しでは何に使うか分からず、
 * 指標が増えるほど「その他」が肥大していた。問いにすると「いつ何を見るか」が
 * そのまま伝わる。景気サイクルの分類は捨てず、各チャートのバッジに残している。
 */
export default function EconomyPage() {
  return (
    // モバイルは間隔を詰める。1 画面目に「最新の状況」まで入れるため (#75)。
    <div className="space-y-10 sm:space-y-16">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">経済</h1>
        {/* 説明は 1 行に絞る。問いの一覧が直下にあるので繰り返さない (#75)。 */}
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>問いごとに指標を並べている</strong>。頻度は各チャートのバッジで示す。
        </p>
        <QuestionIndex charts={CHARTS} questions={ECONOMY_QUESTIONS} />
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <EconomySummary monthly={economy.monthly} weekly={macro} />

      <QuestionSections charts={CHARTS} questions={ECONOMY_QUESTIONS} />
    </div>
  );
}
