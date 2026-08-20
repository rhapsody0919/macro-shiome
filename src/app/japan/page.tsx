import {
  QuestionIndex,
  QuestionSections,
  type QuestionChartDef,
} from '@/components/charts/question-sections';
import { JapanSummary } from '@/components/japan-summary';
import { COLORS } from '@/lib/colors';
import { economy, japanDaily } from '@/lib/data/loader';
import { JAPAN_QUESTIONS, type JapanQuestionId } from '@/lib/questions';

export const metadata = {
  title: '日本 | macro-shiome',
};

/**
 * 日本ページのチャート定義 (#152)。
 *
 * **ページを地域で分けた唯一の例外。** 理由は `JAPAN_QUESTIONS` の注記のとおり。
 * 国際比較 (10年債利回りの国際比較 / 各国の下落率) は市場ページに残している。
 */
const CHARTS: QuestionChartDef<JapanQuestionId>[] = [
  {
    question: 'jp-cycle',
    frequency: 'monthly',
    primaryIndicator: 'jp-di-leading',
    title: '景気動向指数',
    subtitle: '先行・一致・遅行 (2020年平均 = 100)',
    series: [
      {
        key: 'jpDiLeading',
        label: '先行',
        color: COLORS.jpDiLeading,
        width: 2.4,
        indicatorId: 'jp-di-leading',
      },
      {
        key: 'jpDiCoincident',
        label: '一致',
        color: COLORS.jpDiCoincident,
        indicatorId: 'jp-di-coincident',
      },
      {
        key: 'jpDiLagging',
        label: '遅行',
        color: COLORS.jpDiLagging,
        indicatorId: 'jp-di-lagging',
      },
    ],
    notes: [
      <span key="order">
        <strong>3 本の位置関係が局面を示す。</strong>
        先行 → 一致 → 遅行の順に動くため、先行が一致を下回れば減速、
        遅行が一致を追い越していれば局面が進んでいる。
      </span>,
      <span key="us">
        <strong>米国では同じものが取れない。</strong>
        The Conference Board の景気先行指数は著作権で FRED に収録されておらず、
        経済ページでは構成要素から代替を組んでいる。日本は本物を無料で取得できる。
      </span>,
      <span key="base">
        <strong>2020年平均 = 100 の CI</strong>。基準が変わると水準も変わるため、
        古い基準の系列とはつなげていない (2015年基準は 2023-04 が最終)。
        <strong>季節調整済みの系列は提供されていない</strong>ため原数値を出している。
      </span>,
    ],
  },
  {
    question: 'jp-cycle',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    baseline: { value: 50, label: '50 = 横ばい' },
    primaryIndicator: 'jp-watcher-current',
    title: '街角景気 (景気ウォッチャー調査)',
    subtitle: '現状判断DIと先行き判断DI (季節調整済み)',
    series: [
      {
        key: 'jpWatcherCurrent',
        label: '現状判断',
        color: COLORS.jpWatcherCurrent,
        indicatorId: 'jp-watcher-current',
      },
      {
        key: 'jpWatcherOutlook',
        label: '先行き判断',
        color: COLORS.jpWatcherOutlook,
        indicatorId: 'jp-watcher-outlook',
      },
    ],
    notes: [
      <span key="who">
        <strong>取引の現場にいる人の実感。</strong>
        小売・飲食・タクシーなど、景気の動きを直接見る立場の人が答える。
        上の景気動向指数は生産・販売・雇用といった<strong>統計の合成</strong>なので、
        情報源が別で重複しない。
      </span>,
      <span key="outlook">
        <strong>先行き判断はこのページで唯一の「先を見る」系列。</strong>
        景気動向指数の先行指数もハードデータの合成なので、性質が違う。
      </span>,
      <span key="line">
        <strong>50 が横ばい</strong>。DI の定義から決まる線なので引いている。
        「危険水準」のような恣意的な閾値は引いていない。
      </span>,
      <span key="scale">
        上の景気動向指数とは<strong>基準が違う</strong> (あちらは 2020年平均 = 100)。
        同じ図に載せると水準の違いが動きの違いに見えるため分けている。
      </span>,
    ],
  },
  {
    question: 'jp-cycle',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-industrial-production',
    title: '鉱工業 生産・出荷・在庫 (日本)',
    subtitle: '季節調整済み (2020年平均 = 100)',
    series: [
      {
        key: 'jpIndustrialProduction',
        label: '鉱工業生産',
        color: COLORS.jpIndustrialProduction,
        indicatorId: 'jp-industrial-production',
      },
          {
        key: 'jpShipments',
        label: '出荷',
        color: COLORS.jpShipments,
        indicatorId: 'jp-shipments',
      },
      {
        key: 'jpInventory',
        label: '在庫',
        color: COLORS.jpInventory,
        indicatorId: 'jp-inventory',
      },
],
    notes: [
      <span key="raw">
        <strong>加工されていない実量。</strong>
        上の景気動向指数は多数の統計の合成、街角景気は体感。これは製造業が実際にどれだけ
        作ったかで、3 つを並べると「合成・体感・実量」が揃う。
      </span>,
      <span key="level">
        <strong>前年同月比にせず水準で出している。</strong>
        統計ダッシュボードに公表の前年同月比が無く、指数が小数 1 桁しか公表されないため、
        自分で計算すると丸めで誤差が出る。日本の鉱工業生産は季調済指数の水準で見るのが通例。
      </span>,
      <span key="not-di">
        <strong>景気動向指数と同じ図に載せていない。</strong>
        あちらは原数値しか提供されておらず、季調値と重ねると季節性の有無が動きの違いに見える。
      </span>,
    ],
  },
  {
    question: 'jp-cycle',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-inventory-ratio',
    title: '在庫率と稼働率 (日本)',
    subtitle: '2020年基準・季節調整済み',
    series: [
      {
        key: 'jpInventoryRatio',
        label: '在庫率',
        color: COLORS.jpInventoryRatio,
        indicatorId: 'jp-inventory-ratio',
      },
          {
        key: 'jpOperatingRate',
        label: '稼働率',
        color: COLORS.jpOperatingRate,
        indicatorId: 'jp-operating-rate',
      },
],
    notes: [
      <span key="ratio">
        <strong>出荷に対する在庫の比。</strong>
        在庫の絶対量ではなく<strong>売れ行きに対して多いか少ないか</strong>を示す。
        上がれば生産調整が近い。上の鉱工業生産と合わせて読む。
      </span>,
      <span key="us">
        米国の新築住宅在庫月数と同じ発想だが、対象が違う (あちらは住宅、こちらは鉱工業)。
      </span>,
    ],
  },
  {
    question: 'jp-price',
    frequency: 'monthly',
    primaryIndicator: 'jp-cpi-core',
    title: '消費者物価指数 (日本)',
    subtitle: 'コアと総合の前年同月比',
    series: [
      {
        key: 'jpCpiCore',
        label: 'コア (生鮮食品を除く)',
        color: COLORS.jpCpiCore,
        width: 2.4,
        indicatorId: 'jp-cpi-core',
      },
      { key: 'jpCpi', label: '総合', color: COLORS.jpCpi, indicatorId: 'jp-cpi' },
          {
        key: 'jpCpiCoreCore',
        label: 'コアコア (生鮮・エネルギー除く)',
        color: COLORS.jpCpiCoreCore,
        indicatorId: 'jp-cpi-core-core',
      },
],
    notes: [
      <span key="core-core">
        <strong>コアコアが米国のコア CPI と同じ定義。</strong>
        日本の「コア」は生鮮のみ除くため、エネルギー高の局面で米国のコアと動きが違う。
        国際比較にはコアコアを使う。
      </span>,
      <span key="core">
        <strong>日銀が見るのはコア</strong> (生鮮食品を除く総合)。総合は天候で振れるため、
        政策判断には向かない。2 本の差が生鮮食品の影響を示す。
      </span>,
      <span key="path">
        <strong>物価 → 金利 → 円 → 株の順に効く。</strong>
        物価が上がれば利上げ観測が強まり、円高要因になる一方で輸出企業の円換算の売上を押し下げる。
        下の日経平均と USD/JPY を合わせて読む。
      </span>,
      <span key="base">
        <strong>2025年基準。</strong>このページの他の系列 (景気動向指数・輸出入物価) は
        2020年基準なので混同しない。
      </span>,
      <span key="published">
        <strong>公表されている前年同月比をそのまま出している。</strong>
        日本の CPI 指数は小数 1 桁しか公表されず、そこから計算すると丸めで公表値とずれる
        (2026年6月は計算値 1.50% に対し公表値 1.6%)。米国の CPI は指数の桁数が足りるため
        指数から導出しており、日米で経路が違う。
      </span>,
      <span key="not-us">
        米国の CPI とは基準年も対象品目も違うため、同じ図には載せていない。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    primaryIndicator: 'jp-new-job-ratio',
    title: '求人倍率',
    subtitle: '新規と有効 (倍・季節調整済み)',
    series: [
      {
        key: 'jpNewJobRatio',
        label: '新規求人倍率',
        color: COLORS.jpNewJobRatio,
        width: 2.4,
        indicatorId: 'jp-new-job-ratio',
      },
      {
        key: 'jpJobRatio',
        label: '有効求人倍率',
        color: COLORS.jpJobRatio,
        indicatorId: 'jp-job-ratio',
      },
    ],
    notes: [
      <span key="lead">
        <strong>新規が先行、有効が一致。</strong>
        新規求人倍率はその月に新たに出た求人と新たな求職者の比で、
        有効求人倍率は前月からの繰り越しを含む。転換点は新規に先に出る。
      </span>,
      <span key="unit">
        単位が揃っている (倍) ため水準のまま並べている。水準の目安となる補助線は引いていない。
      </span>,
    ],
  },
  {
    question: 'jp-price',
    frequency: 'monthly',
    primaryIndicator: 'jp-producer-price',
    title: '国内企業物価指数 (日本)',
    subtitle: '前年同月比 (2020年基準)',
    series: [
      {
        key: 'jpProducerPrice',
        label: '企業物価',
        color: COLORS.jpProducerPrice,
        indicatorId: 'jp-producer-price',
      },
    ],
    notes: [
      <span key="upstream">
        <strong>消費者物価の上流。</strong>
        企業間の取引価格が上がっても、消費者に転嫁されるとは限らない。
        上の消費者物価と差が開いていれば、企業がコストを吸収している。
      </span>,
      <span key="fast">
        <strong>消費者物価より 1 か月早く出る。</strong>
        物価系の中で最も速く、直近の変化はここに先に現れる。
      </span>,
      <span key="published">
        公表されている前年同月比をそのまま出している。指数は小数 1 桁しか公表されず、
        自分で計算すると丸めでずれるため (#162 で消費者物価が実際にずれた)。
      </span>,
    ],
  },
  {
    question: 'jp-price',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-money-stock',
    title: 'マネーストック M2 (日本)',
    subtitle: '億円 (原数値)',
    series: [
      {
        key: 'jpMoneyStock',
        label: 'M2',
        color: COLORS.jpMoneyStock,
        indicatorId: 'jp-money-stock',
      },
    ],
    notes: [
      <span key="why">
        <strong>物価の背景として読む。</strong>
        通貨量が増え続けても物価が動かない時期は長かった。上の消費者物価と並べて、
        量と物価が連動しているかを見る。
      </span>,
      <span key="raw">
        <strong>季節調整済みの系列は提供されていない</strong>ため原数値。
        水準そのものが大きいので、方向と傾きで読む。
      </span>,
    ],
  },
  {
    question: 'jp-price',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-monetary-base',
    title: 'マネタリーベースと銀行貸出 (日本)',
    subtitle: '億円',
    series: [
      {
        key: 'jpMonetaryBase',
        label: 'マネタリーベース',
        color: COLORS.jpMonetaryBase,
        width: 2.4,
        indicatorId: 'jp-monetary-base',
      },
      {
        key: 'jpBankLending',
        label: '銀行貸出',
        color: COLORS.jpBankLending,
        indicatorId: 'jp-bank-lending',
      },
    ],
    notes: [
      <span key="chain">
        <strong>日銀が供給した通貨が実体経済に届いているか。</strong>
        マネタリーベースは日銀が直接供給する分、銀行貸出は銀行を通じて企業に渡った分。
        <strong>2 本の差が「銀行で止まっているか」を示す。</strong>
      </span>,
      <span key="us">
        米国の FRB バランスシートと商工業貸出に対応する。
        <strong>単位も規模も違うため同じ図には載せていない。</strong>
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-unemployment-rate',
    title: '完全失業率 (日本)',
    subtitle: '％・季節調整済み',
    series: [
      {
        key: 'jpUnemploymentRate',
        label: '完全失業率',
        color: COLORS.jpUnemploymentRate,
        indicatorId: 'jp-unemployment-rate',
      },
    ],
    notes: [
      <span key="pair">
        <strong>上の求人倍率と逆方向に動く。</strong>
        求人が減って失業率が上がれば労働需給の緩みが確かになる。
        片方だけが動いているうちは統計の振れの可能性がある。
      </span>,
      <span key="us">
        米国の失業率とは<strong>調査方法も定義も違う</strong>ため同じ図には載せていない。
        日本は水準が低く動きも小さいので、水準ではなく方向で読む。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    primaryIndicator: 'jp-disposable-income',
    title: '家計の余力 (日本)',
    subtitle: '実質可処分所得と実質消費支出の前年同月比',
    series: [
      {
        key: 'jpDisposableIncome',
        label: '実質可処分所得',
        color: COLORS.jpDisposableIncome,
        width: 2.4,
        indicatorId: 'jp-disposable-income',
      },
      {
        key: 'jpConsumption',
        label: '実質消費支出',
        color: COLORS.jpConsumption,
        indicatorId: 'jp-consumption',
      },
    ],
    notes: [
      <span key="gap">
        <strong>2 本の差が「所得を使っているか」を示す。</strong>
        所得が増えているのに消費が減っていれば買い控え、所得が減って消費も減っていれば
        余力そのものが失われている。片方だけでは区別できない。
      </span>,
      <span key="real">
        <strong>実質で出している。</strong>
        名目だと、消費が増えたのか値上がりしただけなのか判別できない。
        上の消費者物価と合わせて読む。
      </span>,
      <span key="household">
        可処分所得は<strong>勤労者世帯</strong>、消費支出は<strong>二人以上の世帯</strong>で
        対象が違う。可処分所得は給与所得者にしか定義できないため。水準ではなく方向で読む。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-consumption-index',
    title: '総消費動向指数 (日本)',
    subtitle: '実質・2020年基準',
    series: [
      {
        key: 'jpConsumptionIndex',
        label: '総消費動向指数',
        color: COLORS.jpConsumptionIndex,
        indicatorId: 'jp-consumption-index',
      },
    ],
    notes: [
      <span key="wider">
        <strong>家計調査より広く消費全体を捉える。</strong>
        家計調査は世帯の申告ベースだが、こちらは供給側の統計も合成しており、
        単身世帯や施設消費も含む。上の家計の余力と方向が違えば、
        <strong>世帯の実感と経済全体の消費がずれている</strong>ことになる。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-propensity-to-consume',
    title: '平均消費性向 (日本)',
    subtitle: '可処分所得のうち消費に回した割合 (季節調整済み)',
    series: [
      {
        key: 'jpPropensityToConsume',
        label: '平均消費性向',
        color: COLORS.jpPropensityToConsume,
        indicatorId: 'jp-propensity-to-consume',
      },
    ],
    notes: [
      <span key="meaning">
        <strong>下がれば貯蓄に回している。</strong>
        所得が増えても消費性向が下がっていれば、将来不安から溜め込んでいる可能性がある。
      </span>,
      <span key="seasonal">
        <strong>季節調整済み。</strong>
        原数値は賞与の影響で桁が変わる (2026年6月は原数値 38.3 に対し季調値 59.9)。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-working-hours',
    title: '総実労働時間 (日本)',
    subtitle: '指数 (原数値)',
    series: [
      {
        key: 'jpWorkingHours',
        label: '総実労働時間',
        color: COLORS.jpWorkingHours,
        indicatorId: 'jp-working-hours',
      },
    ],
    notes: [
      <span key="wage">
        <strong>賃金は時間 × 単価。</strong>
        時間が減っていれば、時給が上がっても賃金は伸びない。
        下の実質賃金と合わせて、何が効いているかを切り分ける。
      </span>,
      <span key="raw">
        <strong>季節調整済みの系列は提供されていない</strong>ため原数値。
        月ごとの営業日数で振れるので、前年同月と比べて読む。
      </span>,
    ],
  },
  {
    question: 'jp-labor',
    frequency: 'monthly',
    primaryIndicator: 'jp-real-wage',
    title: '実質賃金指数',
    subtitle: '現金給与総額 (季節調整済み)',
    series: [
      {
        key: 'jpRealWage',
        label: '実質賃金',
        color: COLORS.jpRealWage,
        indicatorId: 'jp-real-wage',
      },
    ],
    notes: [
      <span key="seasonal">
        <strong>季節調整済みを出している。</strong>
        現金給与総額には賞与が入るため原数値は 6 月と 12 月に跳ねる
        (2026-02 が 82.1 に対し 2026-06 は 144.1)。季調値なら 97.0 と 98.5 で連続して読める。
      </span>,
      <span key="substitute">
        <strong>賃金であって消費ではない。</strong>
        消費と所得は上の「家計の余力」で見る。こちらは<strong>働いて得た賃金</strong>の
        購買力で、賞与や残業の増減が先に出る。
      </span>,
    ],
  },
  {
    question: 'jp-external',
    frequency: 'monthly',
    primaryIndicator: 'jp-import-price',
    title: '交易条件 (輸出物価と輸入物価)',
    subtitle: '円ベース (2020年平均 = 100)',
    series: [
      {
        key: 'jpImportPrice',
        label: '輸入物価',
        color: COLORS.jpImportPrice,
        width: 2.4,
        indicatorId: 'jp-import-price',
      },
      {
        key: 'jpExportPrice',
        label: '輸出物価',
        color: COLORS.jpExportPrice,
        indicatorId: 'jp-export-price',
      },
    ],
    notes: [
      <span key="gap">
        <strong>2 本の差が交易条件。</strong>
        輸入物価が輸出物価を上回って伸びるほど、同じ量を売っても手元に残る所得が減る。
        水準そのものより<strong>開き方</strong>を見る。
      </span>,
      <span key="yen">
        <strong>円ベースを出している。</strong>
        契約通貨ベースの系列も存在するが、日本企業の損益に効くのは円換算後。
        2 つを同じ図に載せると、差が価格の変化なのか為替の変化なのか判別できなくなる。
      </span>,
      <span key="not-chain">
        <strong>物価の連鎖には足していない。</strong>
        輸入物価は消費者物価の上流に見えるが、交易条件は「所得が海外に出ていくか」を見る別の話。
        経済ページの米国の交易条件とも基準年と対象品目が違うため、同じ図には載せない。
      </span>,
    ],
  },
  {
    question: 'jp-external',
    frequency: 'monthly',
    kind: 'number',
    primaryIndicator: 'jp-current-account',
    title: '経常収支と貿易収支 (日本)',
    subtitle: '億円・季節調整済み',
    series: [
      {
        key: 'jpCurrentAccount',
        label: '経常収支',
        color: COLORS.jpCurrentAccount,
        width: 2.4,
        indicatorId: 'jp-current-account',
      },
      {
        key: 'jpTradeBalance',
        label: '貿易収支',
        color: COLORS.jpTradeBalance,
        indicatorId: 'jp-trade-balance',
      },
    ],
    notes: [
      <span key="yen">
        <strong>円買い需要の構造的な source。</strong>
        黒字が細れば、金利差が同じでも円は支えを失う。下の USD/JPY と合わせて読む。
      </span>,
      <span key="gap">
        <strong>2 本の差が貿易以外の寄与。</strong>
        貿易収支が赤字でも経常収支が黒字なら、海外投資からの所得収支が支えている。
        日本は近年この形が続いている。
      </span>,
      <span key="seasonal">
        <strong>季節調整済み。</strong>
        原数値は月ごとの振れが大きく<strong>符号が変わる</strong>
        (2026年6月は経常収支が原数値 −923 に対し季調値 +13,969)。
      </span>,
      <span key="zero">
        ゼロ線は黒字と赤字の境目で、定義から決まる。恣意的な閾値は引いていない。
      </span>,
    ],
  },
  {
    question: 'jp-market',
    frequency: 'daily',
    primaryIndicator: 'nikkei225',
    title: '日経平均株価',
    subtitle: '円建て。S&P 500 とは水準を直接比べられない',
    series: [{ key: 'nikkei225', label: '日経平均', color: COLORS.nikkei225 }],
    notes: [
      <span key="why">
        <strong>米国だけが動いているのか、世界的な流れなのかを見る。</strong>
        両方が同じ方向なら世界共通の要因 (金利・景気) が効いていると読める。
        金利の国際比較 (上のセクション) と同じ狙い。
      </span>,
      <span key="not-comparable">
        <strong>S&P 500 と水準を直接比べられない。</strong>
        通貨 (円建て) も構成銘柄も違うため、同じ図には載せていない。
        比べるなら騰落率で見ること。
      </span>,
      <span key="fx">
        <strong>為替の影響を受ける。</strong>
        円安は輸出企業の円換算の売上を押し上げるため、日経平均は上がりやすい。
        下の USD/JPY と合わせて読む。
      </span>,
      <span key="copyright">
        著作権は Nikkei Inc. にある。日次 (終値)。日本の休場日は直近の営業日まで遡る。
      </span>,
    ],
  },

  {
    question: 'jp-market',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-topix',
    title: 'TOPIX (東証株価指数)',
    subtitle: '東証全体・時価総額加重',
    series: [
      { key: 'jpTopix', label: 'TOPIX', color: COLORS.jpTopix, indicatorId: 'jp-topix' },
    ],
    notes: [
      <span key="vs-nikkei">
        <strong>日経平均とは構成が違う。</strong>
        日経平均は 225 銘柄の株価加重で値がさ株の影響が大きく、
        TOPIX は東証全体の時価総額加重。
        <strong>2 つの差が「一部の大型株が引っ張っているか」を示す。</strong>
      </span>,
      <span key="scale">
        <strong>水準が桁違いなので同じ図に載せていない</strong>
        (日経平均は 6 万台、TOPIX は 3 千台)。方向を見比べる。
      </span>,
    ],
  },
  {
    question: 'jp-market',
    frequency: 'daily',
    primaryIndicator: 'usdjpy',
    title: 'USD/JPY',
    subtitle: '円/ドル (FRB 公表値)',
    series: [{ key: 'usdjpy', label: 'USD/JPY', color: COLORS.usdjpy }],
    notes: [
      <span key="pair">
        <strong>円安は日経平均の押し上げ要因</strong>になりやすい。輸出企業の円換算の
        売上が増えるため。上の 2 本を並べて見ると、日本株の動きが業績なのか為替なのかを
        切り分けやすい。
      </span>,
      <span key="daily">日次。FRB が公表する日次値をそのまま並べている。</span>,
    ],
  },

  {
    question: 'jp-housing',
    frequency: 'monthly',
    primaryIndicator: 'jp-housing-starts',
    title: '新設住宅着工戸数 (日本)',
    subtitle: '戸・季節調整済み年率換算',
    series: [
      {
        key: 'jpHousingStarts',
        label: '総戸数',
        color: COLORS.jpHousingStarts,
        indicatorId: 'jp-housing-starts',
      },
    ],
    notes: [
      <span key="same-definition">
        <strong>米国の住宅着工件数と同じ定義</strong> (季節調整済み年率換算) だが、
        <strong>単位が違う</strong>ため同じ図には載せていない。日本は<strong>戸</strong>、
        米国は<strong>千戸</strong>。水準を直接比べず、それぞれの方向で読む。
      </span>,
      <span key="why">
        <strong>日本の住宅は金利より人口と税制で動く。</strong>
        米国のように住宅ローン金利で先行して動く構造ではないため、
        上の米国の連鎖 (許可 → 着工 → 販売) と同じ読み方はできない。
      </span>,
      <span key="source">
        出所は国土交通省 建築着工統計調査 (統計ダッシュボード)。
        FRED は日本の住宅着工を提供していない (<code>JPNPERMITMISMEI</code> は 2008 年で提供終了)。
      </span>,
    ],
  },

  {
    question: 'jp-housing',
    frequency: 'monthly',
    primaryIndicator: 'jp-housing-starts-owned',
    title: '新設住宅着工戸数の内訳 (日本)',
    subtitle: '持家と貸家。戸・季調値 (年率換算ではない)',
    series: [
      {
        key: 'jpHousingStartsOwned',
        label: '持家',
        color: COLORS.jpHousingStartsOwned,
        indicatorId: 'jp-housing-starts-owned',
      },
      {
        key: 'jpHousingStartsRented',
        label: '貸家',
        color: COLORS.jpHousingStartsRented,
        indicatorId: 'jp-housing-starts-rented',
      },
    ],
    notes: [
      <span key="split">
        <strong>持家と貸家は動く理由が違う。</strong>
        持家は家計の余力と金利、貸家は相続税対策と利回りで動く。
        総戸数だけを見ると、どちらが動いたのか分からない。
      </span>,
      <span key="unit-jp">
        <strong>上の総戸数とは単位が違う。</strong>
        こちらは季調値そのもので<strong>年率換算していない</strong>ため、水準が 1 桁小さい。
        内訳どうしは単位が揃っているので水準のまま並べている。
      </span>,
    ],
  },
  {
    question: 'jp-housing',
    frequency: 'monthly',
    kind: 'number',
    zeroLine: false,
    primaryIndicator: 'jp-public-works',
    title: '公共工事受注額 (日本)',
    subtitle: '億円',
    series: [
      {
        key: 'jpPublicWorks',
        label: '公共工事受注額',
        color: COLORS.jpPublicWorks,
        indicatorId: 'jp-public-works',
      },
    ],
    notes: [
      <span key="policy">
        <strong>建設需要のうち政策で動く部分。</strong>
        住宅着工が家計の需要を示すのに対し、こちらは財政支出の実行状況。
        景気対策が実際の工事に繋がっているかが出る。
      </span>,
      <span key="unit">
        単位が億円で住宅着工 (戸) と違うため、<strong>同じ図には載せていない</strong>。
      </span>,
    ],
  },
];

/**
 * 日本ページ (#152)。
 *
 * **サマリーは問いごとに 1 指標** (#186)。#152 で作ったときはチャートが 4 枚しかなく
 * 「同じ数字を 2 回出すだけ」として置かなかったが、17 枚に増えて開いた時点では
 * 何も分からない状態になったため追加した。
 */
export default function JapanPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">日本</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          日本の市場と経済指標。米国と単位や定義が違うため、同じ図には載せずページを分けている。
          複数国を並べる図 (10年債利回りの国際比較・各国の下落率) は「市場」にある。
        </p>
        <QuestionIndex charts={CHARTS} questions={JAPAN_QUESTIONS} />
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる (#76)。 */}
      <JapanSummary monthly={economy.monthly} daily={japanDaily} />

      <QuestionSections dailyPoints={japanDaily} charts={CHARTS} questions={JAPAN_QUESTIONS} />
    </div>
  );
}
