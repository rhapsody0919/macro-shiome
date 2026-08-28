import { EconomySummary } from '@/components/economy-summary';
import {
  QuestionIndex,
  QuestionSections,
  type QuestionChartDef,
} from '@/components/charts/question-sections';
import { COLORS } from '@/lib/colors';
import { economy, economyDaily, macro } from '@/lib/data/loader';
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
    frequency: 'monthly',
    primaryIndicator: 'commercial-loans',
    title: '商工業向け貸出',
    subtitle: '前年同月比',
    series: [
      {
        key: 'commercialLoans',
        label: '商工業向け貸出',
        color: COLORS.commercialLoans,
        indicatorId: 'commercial-loans',
      },
    ],
    notes: [
      <span key="quantity">
        <strong>信用の量的 side。</strong>
        市場ページの信用スプレッドは<strong>価格</strong>で、こちらは<strong>量</strong>。
        スプレッドが落ち着いていても貸出が縮んでいれば、企業は資金を取れていない。
      </span>,
      <span key="lag">
        銀行の貸出態度は景気に遅れて厳しくなるため、後追いの確認に使う。
      </span>,
    ],
  },
  {
    question: 'slowdown',
    frequency: 'daily',
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
      <span key="copyright">著作権は Indeed にある。日次値をそのまま並べている。</span>,
    ],
  },
  {
    question: 'slowdown',
    frequency: 'weekly',
    primaryIndicator: 'initial-claims',
    explainIndicators: ['initial-claims', 'continued-claims'],
    title: '新規失業保険申請件数',
    subtitle: '労働市場の悪化を最も早く捉える (週次)',
    series: [
      { key: 'initialClaims', label: '新規申請', color: COLORS.initialClaims, width: 2.4 },
      { key: 'continuedClaims', label: '継続受給', color: COLORS.continuedClaims },
    ],
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
    question: 'slowdown',
    frequency: 'monthly',
    primaryIndicator: 'ny-fed-survey',
    title: '地区連銀サーベイと S&P500',
    subtitle: '製造業の景況感 (拡散指数、左軸、0 が改善と悪化が同数) と S&P500 の前年比 (右軸)',
    kind: 'number',
    series: [
      {
        key: 'nyFedSurvey',
        label: 'NY連銀',
        color: COLORS.nyFedSurvey,
        width: 2.4,
        indicatorId: 'ny-fed-survey',
      },
      {
        key: 'phillyFedSurvey',
        label: 'フィラデルフィア連銀',
        color: COLORS.phillyFedSurvey,
        indicatorId: 'philly-fed-survey',
      },
      {
        key: 'sp500Yoy',
        label: 'S&P500 (前年比)',
        color: COLORS.sp500Yoy,
        indicatorId: 'sp500',
        axis: 'right',
        kind: 'percent',
      },
    ],
    notes: [
      <span key="fastest">
        <strong>月次で最も発表が早い。</strong>
        当月分が当月中旬に出るため、他の月次指標より 2〜6 週間先に今月の状況が分かる。
        週次の新規求人・失業保険申請に次ぐ速報性。
      </span>,
      <span key="zero">
        <strong>ゼロ線は定義から決まる基準。</strong>
        「前月より改善した」と答えた企業と「悪化した」と答えた企業が同数ならゼロになる。
        恣意的に置いた閾値ではない。
      </span>,
      <span key="ism">
        <strong>ISM 新規受注指数の代替だが同等ではない。</strong>
        ISM は著作権で FRED に収録されていない。こちらは
        <strong>2 地区の製造業だけ</strong>が対象で、全米の製造業を代表しない。
        NY 連銀は第2地区、フィラデルフィア連銀は第3地区
        (ペンシルベニア・ニュージャージー・デラウェア)。
      </span>,
      <span key="volatile">
        <strong>振れが大きい。</strong>
        回答企業数が少なく単月では上下しやすいので、水準そのものより
        <strong>数か月の方向</strong>を見る。The Conference Board の景気指数の構成要素では
        ないため、景気サイクルのバッジは付けていない。
      </span>,
      <span key="sp500-axis">
        <strong>S&P500 だけ右軸・単位が違う。</strong>
        水準ではなく前年比 (%) で表示している。景況感の変化が株価に先行するかを見る図で、
        左軸のサーベイと同じ軸に載せると水準の桁違いで読めなくなる。
      </span>,
      <span key="sp500-limit">
        <strong>S&P500 は直近 10 年分しか表示できない。</strong>
        FRED が S&P/Dow Jones 系列を 10 年分しか提供していないための制約で、
        NY連銀・フィラデルフィア連銀の系列より表示期間が短い。
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
        key: 'weeklyHoursTotal',
        label: '全産業',
        color: COLORS.weeklyHoursTotal,
        indicatorId: 'weekly-hours-total',
      },
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
    question: 'slowdown',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'capacity-utilization',
    title: '設備稼働率',
    subtitle: '%・季節調整済み',
    series: [
      {
        key: 'capacityUtilization',
        label: '設備稼働率',
        color: COLORS.capacityUtilization,
        indicatorId: 'capacity-utilization',
      },
    ],
    notes: [
      <span key="level">
        <strong>水準で読む。長期平均は 80% 前後。</strong>
        下回れば設備に余剰があり、上がりきれば設備投資が必要になる。
        前年同月比にすると「80% を割った」という水準の意味が消える。
      </span>,
      <span key="fast">
        <strong>生産系で最も速い。</strong>
        鉱工業生産より 1 か月早く出るため、直近の変化はここに先に現れる。
      </span>,
      <span key="seasonal">
        <strong>「季節調整済み」とは、</strong>
        年末商戦や夏の生産調整のような毎年同じ時期に起きる変動をあらかじめ
        取り除いた値のこと。年内の月ごとの水準をそのまま比べられる
        (このページの他のチャートでも同じ意味で使う)。
      </span>,
    ],
  },
  {
    question: 'slowdown',
    frequency: 'monthly',
    primaryIndicator: 'durable-goods-orders',
    title: '耐久財受注と在庫',
    subtitle: '前年同月比',
    series: [
      {
        key: 'durableGoodsOrders',
        label: '耐久財新規受注',
        color: COLORS.durableGoodsOrders,
        width: 2.4,
        indicatorId: 'durable-goods-orders',
      },
      {
        key: 'businessInventories',
        label: '企業在庫',
        color: COLORS.businessInventories,
        indicatorId: 'business-inventories',
      },
    ],
    notes: [
      <span key="cycle">
        <strong>受注が伸びても在庫が積み上がっていれば生産は続かない。</strong>
        2 本の差が在庫循環を示す。在庫が受注を上回って伸びていれば、
        次に来るのは減産。
      </span>,
      <span key="overlap">
        <strong>上の資本財新規受注とは対象が違う。</strong>
        あちらは LEI の構成要素で設備投資に絞った系列、こちらは自動車・航空機を含む耐久財全体。
        <strong>含む関係にあるため同じ図には載せていない</strong> (二重計上に見えるため)。
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
    question: 'labor',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'u6-rate',
    title: '労働市場の質',
    subtitle: '広義失業率・参加率・就業率 (%)',
    series: [
      { key: 'u6Rate', label: '広義失業率 (U-6)', color: COLORS.u6Rate, width: 2.4, indicatorId: 'u6-rate' },
      { key: 'participationRate', label: '労働参加率', color: COLORS.participationRate, indicatorId: 'participation-rate' },
      { key: 'employmentRatio', label: '就業率', color: COLORS.employmentRatio, indicatorId: 'employment-ratio' },
    ],
    notes: [
      <span key="u6">
        <strong>広義失業率は不完全就業と求職を諦めた人を含む。</strong>
        公式失業率 (U-3) との差が「統計に出ない失業」の大きさ。
      </span>,
      <span key="denominator">
        <strong>参加率は失業率の分母側。</strong>
        参加率が下がれば失業率は自動的に下がる。失業率の改善が「職が増えた」のか
        「探すのをやめた」のかを、この 2 本で判別する。
      </span>,
      <span key="ratio">
        <strong>就業率は「探しているか」に左右されない。</strong>
        人口に対する就業者の割合なので参加率より頑健。
      </span>,
      <span key="not-u3">
        下の失業率 (U-3) とは<strong>定義が違うため同じ図に載せていない</strong>。
      </span>,
    ],
  },
  {
    // 非農業部門雇用者数は景気一致指数 (CEI) の構成要素。
    question: 'labor',
    frequency: 'monthly',
    primaryIndicator: 'payrolls',
    title: '労働市場',
    subtitle: '雇用者数の前年同月比 (4 つの捉え方)',
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
      {
        key: 'adpEmployment',
        label: 'ADP雇用者数',
        color: COLORS.adpEmployment,
        indicatorId: 'adp-employment',
      },
    ],
    notes: [
      <span key="diff">
        <strong>4 つは調査方法・集計元が違う。</strong>
        ニュースで報じられる「雇用統計」は<strong>非農業部門雇用者数</strong> (BLS の事業所調査) で、
        <strong>自営業者と農業従事者を含まない</strong>。就業者数 (家計調査) はそれらを含むため、
        働いている人の総数に近い。フルタイムは雇用の質を見る。ADP雇用者数は政府統計ではなく
        <strong>給与計算サービス企業のデータ</strong>を集計したもので、母集団も集計方法も異なる。
      </span>,
      <span key="coincident">
        <strong>雇用は「先行」ではなく「一致」指標。</strong>
        The Conference Board は非農業部門雇用者数を景気一致指数の構成要素としている。
        悪化が見えた時点で、既に景気が転換している可能性がある。
      </span>,
      <span key="yoy">
        前年同月比で揃えている。水準 (人/千人) は系列ごとに桁が違い、変化の大きさが比べられないため。
      </span>,
      <span key="crosscheck">
        <strong>ADP雇用者数は公式統計の代替ではなくクロスチェック。</strong>
        独立したデータソースが同じ方向を示せば、労働市場の傾向により確信が持てる。
        逆に方向が食い違えば、どちらか一方の振れに注意が要る。
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
          {
        key: 'hires',
        label: '採用',
        color: COLORS.hires,
        indicatorId: 'hires',
      },
      {
        key: 'quits',
        label: '自発的離職',
        color: COLORS.quits,
        indicatorId: 'quits',
      },
      {
        key: 'layoffs',
        label: 'レイオフ・解雇',
        color: COLORS.layoffs,
        indicatorId: 'layoffs',
      },
],
    notes: [
      <span key="official">
        調査に基づく公式統計。<strong>Indeed の新規求人より発表が 2 か月ほど遅い</strong>が、
        水準の基準になる。速報性を求めるなら「景気は減速しているか」の新規求人を見る。
      </span>,
      <span key="meaning">求人が減ると採用が細り、やがて雇用者数の減少につながる。</span>,
      <span key="balance">
        <strong>求人とレイオフの均衡が労働市場の先行きを決める</strong> (#335)。
        求人が少なくてもレイオフが少なければ失業は急に増えない。
        レイオフが増え始めると、少ない求人では吸収できず失業の増加が加速しやすい。
      </span>,
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
        key: 'realDisposableTotal',
        label: '実質可処分所得 (総額)',
        color: COLORS.realDisposableTotal,
        indicatorId: 'real-disposable-income',
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
        <strong>総額と 1 人当たりを並べる理由:</strong> 米国は人口が増え続けるため、
        総額が横ばいでも 1 人当たりでは減っていることがある。
        <strong>2 本の差が人口増の寄与</strong>にあたる。
      </span>,
      <span key="real">
        いずれも実質値 (物価変動を除いた値)。名目では物価上昇分だけ増えて見える。
      </span>,
    ],
  },
  {
    question: 'consumption',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'vehicle-sales',
    title: '自動車販売',
    subtitle: '百万台・季節調整済み年率',
    series: [
      {
        key: 'vehicleSales',
        label: '自動車販売',
        color: COLORS.vehicleSales,
        indicatorId: 'vehicle-sales',
      },
    ],
    notes: [
      <span key="volatile">
        <strong>小売の中で最も振れる項目。</strong>
        金利に敏感で、利上げ局面では先に落ちる。上の小売売上の総合とコアの差も
        大部分がここで説明できる。
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
          {
        key: 'retailSalesTotal',
        label: '総合',
        color: COLORS.retailSalesTotal,
        indicatorId: 'retail-sales-total',
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
    primaryIndicator: 'real-consumption',
    title: '家計の余力',
    subtitle: '実質可処分所得と実質消費支出の前年同月比',
    series: [
      {
        key: 'realDisposableTotal',
        label: '実質可処分所得',
        color: COLORS.realDisposableTotal,
        width: 2.4,
        indicatorId: 'real-disposable-income',
      },
      {
        key: 'realConsumption',
        label: '実質消費支出',
        color: COLORS.realConsumption,
        indicatorId: 'real-consumption',
      },
    ],
    notes: [
      <span key="gap">
        <strong>2 本の差が「所得を使っているか」を示す。</strong>
        所得が増えているのに消費が減っていれば買い控え、所得が減って消費も減っていれば
        余力そのものが失われている。<strong>片方だけでは区別できない</strong>のが
        下の貯蓄率だけを見ていたときの問題だった。
      </span>,
      <span key="real">
        どちらも実質 (連鎖2017年ドル)・季節調整済み年率。
        名目だと、消費が増えたのか値上がりしただけなのか判別できない。
      </span>,
      <span key="japan">
        日本にも同じ図がある (「日本」ページの「家計の余力」)。
        <strong>定義は揃えてあるが、対象世帯も基準も違うため同じ図には載せていない。</strong>
      </span>,
    ],
  },
  {
    question: 'consumption',
    frequency: 'monthly',
    primaryIndicator: 'visa-discretionary-spending',
    title: 'VISA消費指数',
    subtitle: '裁量的消費と非裁量的消費 (100が基準)',
    kind: 'number',
    zeroLine: false,
    baseline: { value: 100, label: '100 = 基準' },
    series: [
      {
        key: 'visaDiscretionary',
        label: '裁量的消費 (レジャー・外食・旅行等)',
        color: COLORS.visaDiscretionary,
        width: 2.4,
        indicatorId: 'visa-discretionary-spending',
      },
      {
        key: 'visaNonDiscretionary',
        label: '非裁量的消費 (生活必需品)',
        color: COLORS.visaNonDiscretionary,
        indicatorId: 'visa-non-discretionary-spending',
      },
    ],
    notes: [
      <span key="gap">
        <strong>2 本の差が「支出全般を絞っているか、余裕のある部分だけを削っているか」を示す。</strong>
        裁量的消費だけが沈んでいれば家計にまだ選択の余地がある状態、非裁量的消費まで
        沈んでいれば生活必需品への支出まで切り詰めている状態。
      </span>,
      <span key="source">
        VISA のカード決済データを集計した指数で、上の「家計の余力」(政府統計) とは
        <strong>別のデータソース・別の集計方法</strong>。リアルタイム性の高いクレジットカード
        データという性質上、政府統計より速報性がある。
      </span>,
      <span key="baseline">
        <strong>100 はデータの基準そのもの</strong>であって恣意的な閾値ではない。
        100 を上回れば拡大、下回れば縮小を意味する。
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
        width: 2.4,
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
      <span key="level">
        水準そのものが意味を持つため、前年同月比には変換していない。
        <strong>金額そのものは次の図</strong>で見る。
      </span>,
    ],
  },
  {
    question: 'consumption',
    frequency: 'monthly',
    primaryIndicator: 'personal-saving',
    title: '個人貯蓄額',
    subtitle: '貯蓄に回った金額の前年同月比',
    series: [
      {
        key: 'personalSaving',
        label: '個人貯蓄額',
        color: COLORS.personalSaving,
        indicatorId: 'personal-saving',
      },
    ],
    notes: [
      <span key="why">
        <strong>貯蓄率だけでは足りない。</strong>
        率は<strong>所得が減っても上がる</strong>ため、「取り崩している」のか
        「所得が減っただけ」なのかが判別できない。金額が減っていれば取り崩しが起きている。
      </span>,
      <span key="yoy">
        <strong>前年同月比で見る。</strong>
        貯蓄率 (%) と金額 (10億ドル) は桁が違い、同じ軸に並べられないため図を分けている。
        金額の水準は季節や一時的な給付で振れるので、変化率の方が読みやすい。
      </span>,
      <span key="chain">
        所得 (前の問い) → 貯蓄率 → 貯蓄額 → 小売売上、という順で家計の余力が減っていく。
        <strong>貯蓄の取り崩しには限界がある</strong>ため、この図が下を向き続けると消費は続かない。
      </span>,
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
    frequency: 'monthly',
    primaryIndicator: 'pce-core',
    title: 'コア物価',
    subtitle: '食品・エネルギーを除く前年同月比',
    series: [
      {
        key: 'pceCore',
        label: 'コア PCE',
        color: COLORS.pceCore,
        width: 2.4,
        indicatorId: 'pce-core',
      },
      { key: 'cpiCore', label: 'コア CPI', color: COLORS.cpiCore, indicatorId: 'cpi-core' },
      { key: 'cpiRent', label: '家賃 CPI', color: COLORS.cpiRent, indicatorId: 'cpi-rent' },
    ],
    notes: [
      <span key="terms">
        <strong>CPI (消費者物価指数) は家計が実際に買う商品・サービスの価格を、
          PCE (個人消費支出物価指数) は家計に代わって企業や政府が支払う分も含めた
          より広い範囲の価格を集計したもの。</strong>
        どちらも「物価が前年よりどれだけ上がったか」を示す指標で、ニュースでよく
        使われるのは CPI、FRB が政策判断に使うのは PCE。「コア」は変動の大きい食品・
        エネルギーを除いた値で、基調的な物価の動きを見るために使う。
      </span>,
      <span key="target">
        <strong>コア PCE が FRB の物価目標そのもの。</strong>
        2% はこの系列に対して設定されている。総合は天候と原油で振れるため政策判断に向かない。
      </span>,
      <span key="cpi-vs-pce">
        <strong>コア CPI とは水準が違う。</strong>
        PCE は品目の入れ替えが早く反映され、医療費の扱いも違う。
        どちらが高いかではなく、2 本が同じ方向を向いているかを見る。
      </span>,
      <span key="rent">
        <strong>家賃は最も粘着的。</strong>
        契約更新のタイミングで反映されるため実勢に遅れる。コアの動きの大部分を説明する。
      </span>,
      <span key="not-total">
        下の「物価の連鎖」の総合 CPI・PCE とは<strong>定義が違うため同じ図に載せていない</strong>。
      </span>,
    ],
  },
  {
    question: 'prices',
    frequency: 'daily',
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
        <strong>日次。</strong>この問いで唯一の日次指標で、物価の変化を最も早く示す。
        他は月次なので、直近の動きはここにしか出ない。
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
        key: 'producerPriceAll',
        label: 'PPI 総合 (商品)',
        color: COLORS.producerPriceAll,
        indicatorId: 'producer-price-all',
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
    question: 'prices',
    frequency: 'monthly',
    primaryIndicator: 'export-price',
    title: '交易条件 (輸入物価 vs 輸出物価)',
    subtitle: '仕入れ価格と販売価格の前年同月比',
    series: [
      {
        key: 'importPrice',
        label: '輸入物価 (仕入れ)',
        color: COLORS.importPrice,
        width: 2.4,
        indicatorId: 'import-price',
      },
      {
        key: 'exportPrice',
        label: '輸出物価 (販売)',
        color: COLORS.exportPrice,
        indicatorId: 'export-price',
      },
    ],
    notes: [
      <span key="why">
        <strong>輸入物価は米国企業の仕入れ価格、輸出物価は海外に売るときの販売価格。</strong>
        輸入だけ上がって輸出が上がらない状態は、
        <strong>コスト上昇を転嫁できていない</strong>ことを意味し、企業業績の圧迫要因になる。
      </span>,
      <span key="not-chain">
        <strong>物価の連鎖 (前の図) の上流ではない。</strong>
        あちらは輸入物価 → 生産者物価 → CPI と国内に伝わる流れ。
        こちらは対外的な売り買いの価格差で、別の話として読む。
      </span>,
      <span key="sa">
        どちらも季節調整なし。前年同月比では季節性がおおむね相殺される。
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
    question: 'housing',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'new-home-supply',
    title: '新築住宅の在庫月数',
    subtitle: 'か月・季節調整済み',
    series: [
      {
        key: 'newHomeSupply',
        label: '在庫月数',
        color: COLORS.newHomeSupply,
        indicatorId: 'new-home-supply',
      },
    ],
    notes: [
      <span key="balance">
        <strong>需給バランスを直接示す。</strong>
        いまの販売ペースで在庫が何か月分あるか。6 か月前後が均衡とされ、
        積み上がれば値下げ圧力になる。
      </span>,
      <span key="why">
        着工や販売の件数だけでは需給が分からない。
        <strong>売れ行きに対して多いか少ないか</strong>はこの指標にしか出ない。
      </span>,
    ],
  },
  {
    question: 'housing',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'existing-home-sales',
    title: '中古住宅販売件数',
    subtitle: '件・季節調整済み年率',
    series: [
      {
        key: 'existingHomeSales',
        label: '中古住宅販売',
        color: COLORS.existingHomeSales,
        indicatorId: 'existing-home-sales',
      },
    ],
    notes: [
      <span key="share">
        <strong>米国の住宅取引の大半を占める。</strong>
        上の連鎖に出てくる新築住宅販売は取引量では少数で、市場全体の動きは中古が決める。
      </span>,
      <span key="short">
        <strong>直近 13 か月しか線が引けない。</strong>
        NAR の著作権で FRED が 13 か月分しか提供しないため。
        <strong>毎日取得して積み上げている</strong>ので、時間が経つほど伸びる
        (最高値からの下落率と同じ考え方)。
      </span>,
      <span key="not-chain">
        <strong>上の連鎖と同じ図に載せていない。</strong>
        あちらは千戸、こちらは件で単位が違い、期間も揃わない。
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
        key: 'housingStartsSingle',
        label: '着工 (一戸建て)',
        color: COLORS.housingStartsSingle,
        indicatorId: 'housing-starts-single',
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
          月次の<strong>横軸は対象月</strong> (発表日ではない)。
        </p>
        <QuestionIndex charts={CHARTS} questions={ECONOMY_QUESTIONS} />
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <EconomySummary monthly={economy.monthly} weekly={macro} />

      <QuestionSections dailyPoints={economyDaily} charts={CHARTS} questions={ECONOMY_QUESTIONS} />
    </div>
  );
}
