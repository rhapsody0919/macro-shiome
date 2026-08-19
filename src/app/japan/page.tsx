import {
  QuestionIndex,
  QuestionSections,
  type QuestionChartDef,
} from '@/components/charts/question-sections';
import { COLORS } from '@/lib/colors';
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
    ],
    notes: [
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
        <strong>家計調査の月次消費支出は代わりに使えない。</strong>
        家計消費指数は 2017-12 で提供が止まっている。家計の余力はこの実質賃金で見ているが、
        <strong>消費そのものではない</strong>点に注意する。
      </span>,
    ],
  },
  {
    question: 'jp-trade',
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
];

/**
 * 日本ページ (#152)。
 *
 * **サマリーは置いていない。** 4 枚しかなく、1 画面目でほぼ全部が見えるため、
 * 直近の値を別途まとめても同じ数字を 2 回出すだけになる。
 * チャートが増えたら他ページと同じくサマリーを足す (#76)。
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

      <QuestionSections charts={CHARTS} questions={JAPAN_QUESTIONS} />
    </div>
  );
}
