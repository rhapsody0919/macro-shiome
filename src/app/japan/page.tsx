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
