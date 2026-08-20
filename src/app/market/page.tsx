import { MarketSummary } from '@/components/market-summary';
import {
  QuestionIndex,
  QuestionSections,
  type QuestionChartDef,
} from '@/components/charts/question-sections';
import { COLORS } from '@/lib/colors';
import { macro, marketDaily } from '@/lib/data/loader';
import { MARKET_QUESTIONS, type MarketQuestionId } from '@/lib/questions';

export const metadata = {
  title: '市場 | macro-shiome',
};

/** 市場ページのチャート定義 (#89)。 */
const CHARTS: QuestionChartDef<MarketQuestionId>[] = [
  {
    question: 'financial',
    frequency: 'daily',
    primaryIndicator: 'dgs10',
    title: '金利の内訳',
    subtitle: '名目 10 年債利回り・期待インフレ率・実質金利',
    kind: 'percent',
    series: [
      { key: 'nominalRate', label: '名目10年債', color: COLORS.nominalRate },
      { key: 'breakeven', label: '期待インフレ率', color: COLORS.breakeven },
      { key: 'realRate', label: '実質金利', color: COLORS.realRate },
      { key: 'fedFundsRate', label: 'FF金利 (政策金利)', color: COLORS.fedFundsRate },
    ],
    notes: [
      <span key="def">
        実質金利 = 名目 10 年債利回り − 期待インフレ率。イールドスプレッドの計算に使う値。
      </span>,
      <span key="ff">
        <strong>FF 金利は FRB が誘導する短期の政策金利</strong>で、10 年債は市場が決める長期金利。
        政策金利が長期金利を上回ると逆イールドになる。
      </span>,
      <span key="why">
        名目が同じでも期待インフレ率が動けば実質金利は変わる。株式の相対的な魅力は実質金利で
        測るため、4 つを並べて構造を見る。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'weekly',
    primaryIndicator: 'potential-gdp',
    title: '10年債の理論値',
    subtitle: '期待インフレ率 + 潜在成長率。名目がこれを超えると経済を抑制する目安',
    kind: 'percent',
    series: [
      { key: 'nominalRate', label: '名目10年債 (実際)', color: COLORS.nominalRate, width: 2.4 },
      { key: 'treasuryFairValue', label: '理論値', color: COLORS.treasuryFairValue, width: 2.4 },
      { key: 'breakeven', label: '内訳: 期待インフレ率', color: COLORS.breakeven },
      { key: 'potentialGrowth', label: '内訳: 潜在成長率', color: COLORS.potentialGrowth },
    ],
    notes: [
      <span key="def">
        <strong>理論値 = 期待インフレ率 + 潜在成長率</strong>。名目金利は長期的に「物価の
        見通し」と「経済の実力」に収束するという考え方で、
        <strong>実際がこれを上回ると金利が経済成長を上回る</strong>ため、企業の設備投資と
        個人消費を抑制する目安になる。下の細い 2 本を足したものが太い緑の線。
      </span>,
      <span key="not-threshold">
        <strong>恣意的な閾値ではない。</strong>
        定義から決まる値なので、危険水準の線を引かない方針 (VIX・イールドスプレッド) と
        矛盾しない。ただし<strong>「超えたら必ず下落する」という意味ではない</strong>。
        乖離が続いた期間も過去にある。
      </span>,
      <span key="cbo">
        <strong>潜在成長率は CBO (議会予算局) の推計値で、観測値ではない。</strong>
        潜在 GDP (四半期) の前年同期比として計算しており、直近は 2.2% 前後。
        参考記事が置いている 2% は近い値だが、
        <strong>CBO の推計は四半期ごとに動く</strong>ので固定値ではない。
      </span>,
      <span key="quarterly">
        潜在成長率は四半期なので、四半期の間は同じ値が続く。
        期待インフレ率は市場が決める 10 年 BEI (観測値) を使っており、
        <strong>参考記事が使う「FRB の物価目標 2%」とは定義が違う</strong>。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'daily',
    kind: 'percent',
    primaryIndicator: 'breakeven-5y5y',
    title: '期待インフレ率',
    subtitle: '市場が織り込む物価',
    series: [
      { key: 'breakeven5y5y', label: '5年先5年', color: COLORS.breakeven5y5y, width: 2.4 },
      { key: 'breakeven', label: '10年 BEI', color: COLORS.breakeven },
      { key: 'breakeven5y', label: '5年 BEI', color: COLORS.breakeven5y },
    ],
    notes: [
      <span key="forward">
        <strong>5年先5年が FRB の見る指標。</strong>
        5 年後から始まる 5 年間の期待で、足元の物価変動の影響を受けにくい。
        ここが動くと「期待が外れた」ことになる。
      </span>,
      <span key="market">
        <strong>実績ではなく 市場が織り込む物価。</strong>
        名目債と TIPS の利回り差から求める。経済ページのコア物価が実績、こちらが先行き。
      </span>,
      <span key="same">
        3 本とも同じ手法なので重ねられる。期間の違いが「いつの物価を織り込んでいるか」を示す。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'daily',
    kind: 'percent',
    primaryIndicator: 'dgs2',
    title: '短期金利',
    subtitle: '3か月から 2年までの期間構造',
    series: [
      { key: 'twoYearRate', label: '2年債', color: COLORS.twoYearRate, width: 2.4 },
      { key: 'sofr', label: 'SOFR', color: COLORS.sofr },
          { key: 'tbill3m', label: '3か月 T-Bill', color: COLORS.tbill3m },
],
    notes: [
      <span key="expectation">
        <strong>2年債は政策金利の織り込みを映す。</strong>
        今後 2 年の利下げ・利上げ見通しが price される。上の「金利の内訳」の FF 金利より先に動く。
      </span>,
      <span key="structure">
        <strong>3か月 → 2年の期間構造。</strong>
        3か月は政策金利にほぼ連動し、2年は今後の変更を織り込む。
        2 本の差が利下げ・利上げの織り込みそのもの。
      </span>,
      <span key="actual">
        <strong>SOFR は翌日物の実勢。</strong>
        国債を担保にした実際の資金調達コストで、FF 金利より市場の実態に近い。
      </span>,
      <span key="separate">
        <strong>「金利の内訳」と分けている。</strong>
        あちらは 10年債を名目・期待インフレ率・実質に分解する図で、
        6 本にすると何と何を比べるのか読めなくなる。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'daily',
    primaryIndicator: 't10y2y',
    title: 'イールドカーブ',
    subtitle: '長短金利差。負なら逆イールド',
    kind: 'percent',
    signed: true,
    series: [
      { key: 'termSpread', label: '10年 − 2年', color: COLORS.termSpread, width: 2.4 },
      { key: 'termSpread3m', label: '10年 − 3か月', color: COLORS.termSpread3m },
    ],
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
      <span key="daily">日次。FRED が公表する日次値をそのまま並べている。</span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'monthly',
    primaryIndicator: 'us-10y-monthly',
    title: '10年債利回りの国際比較',
    subtitle: '日米独。金利上昇が世界的な現象か固有要因かを見る',
    kind: 'percent',
    zeroLine: false,
    series: [
      {
        key: 'usTenYearMonthly',
        label: '米国',
        color: COLORS.nominalRate,
        width: 2.4,
        indicatorId: 'us-10y-monthly',
      },
      { key: 'jpTenYear', label: '日本', color: COLORS.jpTenYear, indicatorId: 'jp-10y' },
      { key: 'deTenYear', label: 'ドイツ', color: COLORS.deTenYear, indicatorId: 'de-10y' },
    ],
    notes: [
      <span key="why">
        <strong>米国だけを見ていると、金利上昇が米国固有の要因なのか世界的な現象なのかが
        分からない。</strong>
        3 か国が揃って上がっていれば、物価と中央銀行の姿勢が世界的に変わったと読める。
      </span>,
      <span key="same-def">
        <strong>3 か国とも同じ定義の系列</strong>を使っている (OECD 経由の長期国債利回り、
        月中平均)。国ごとに違う定義で並べると、差が「定義の違い」なのか
        「金利の差」なのか分からなくなるため。
      </span>,
      <span key="lag">
        <strong>月次なので、上の週次チャートより 2 か月ほど遅れる。</strong>
        日次で取れるのは米国だけで、日本とドイツは無料の日次系列が無い。
        足元の動きは「金利の内訳」を見ること。
      </span>,
      <span key="us-diff">
        米国の線は<strong>週次チャートの名目 10 年債とは別系列</strong>
        (日次の DGS10 ではなく月次)。月中平均なので値も一致しない。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'weekly',
    signed: true,
    primaryIndicator: 'nfci',
    title: '金融環境指数',
    subtitle: '0 が平均、正なら引き締まり',
    series: [
      { key: 'nfci', label: 'NFCI (総合)', color: COLORS.nfci, width: 2.4 },
      { key: 'anfci', label: 'ANFCI (景気調整済み)', color: COLORS.anfci },
      { key: 'financialStress', label: '金融ストレス指数', color: COLORS.financialStress },
    ],
    notes: [
      <span key="direct">
        <strong>この問いに最も直接答える指標。</strong>
        下の信用スプレッドやイールドカーブは部品で、こちらは株式・債券・信用・
        シャドーバンキングの 105 指標を合成した総合指数。
      </span>,
      <span key="diff">
        <strong>NFCI と ANFCI の差が「なぜ緩いか」を分ける。</strong>
        ANFCI は景気循環の影響を除いた分。景気が良いから緩いのか、金融要因で緩いのかが読める。
      </span>,
      <span key="third">
        <strong>金融ストレス指数は別の連銀が別の手法で作る。</strong>
        3 本が同じ方向を向いていれば、手法によらず環境が動いていることになる。
      </span>,
      <span key="zero">
        ゼロ線は長期平均で、定義から決まる。恣意的な「危険水準」は引いていない。
        水準ではなく<strong>0 からの距離</strong>で読む。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'weekly',
    kind: 'number',
    primaryIndicator: 'fed-balance-sheet',
    title: 'FRB バランスシート',
    subtitle: '百万ドル',
    series: [{ key: 'fedBalanceSheet', label: '総資産', color: COLORS.fedBalanceSheet }],
    notes: [
      <span key="qt">
        <strong>量的引き締めの進捗。</strong>
        縮小が続けば市場から流動性が抜ける。金利 (価格) とは別の経路で効く。
      </span>,
      <span key="level">
        水準そのものより<strong>傾き</strong>を見る。増やしているのか減らしているのか。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'daily',
    primaryIndicator: 'hy-spread',
    title: '信用スプレッド',
    subtitle: '社債と国債の利回り差 (拡大がリスク回避)',
    kind: 'percent',
    series: [
      { key: 'hySpread', label: 'ハイイールド債', color: COLORS.hySpread },
      { key: 'igSpread', label: '投資適格債', color: COLORS.igSpread },
    ],
    notes: [
      <span key="meaning">
        <strong>拡大がリスク回避、縮小がリスク選好。</strong>
        投資家が低格付け債を敬遠すると利回り差が広がる。
        <strong>株式より早く動くことがある</strong>ため、相場の転換を捉える手がかりになる。
      </span>,
      <span key="two">
        ハイイールド債 (低格付け) の方が振れが大きい。
        <strong>投資適格債まで広がったら信用不安が優良企業に及んでいる</strong>合図。
      </span>,
      <span key="no-threshold">
        水準の目安となる補助線は引いていない。閾値に定説が無く恣意的になるため
        (VIX・イールドスプレッドと同じ判断)。過去の水準と比べて読むこと。
      </span>,
      <span key="copyright">著作権は Ice Data Indices にある。</span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'weekly',
    primaryIndicator: 'credit-conditions',
    title: '信用状況',
    subtitle: '企業や家計が資金を借りやすいか (ゼロが平均)',
    signed: true,
    series: [{ key: 'creditConditions', label: '信用状況指数', color: COLORS.creditConditions }],
    notes: [
      <span key="direction">
        <strong>正が引き締まり、負が緩み。</strong>
        ゼロが平均的な状態。上昇は資金を借りにくくなっていることを示し、
        赤い領域 (負) は平均より緩い状態。
      </span>,
      <span key="lei">
        The Conference Board の景気先行指数の構成要素に「Leading Credit Index」があるが、
        <strong>あちらは独自の合成指標で公開されていない</strong>。ここでは同じく信用状況の
        逼迫度を測る Chicago Fed の指数を使っており、<strong>同じものではない</strong>。
      </span>,
      <span key="copyright">著作権は Chicago Fed にある。週次。</span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'monthly',
    primaryIndicator: 'federal-deficit',
    title: '財政収支',
    subtitle: '連邦政府の月次収支 (百万ドル、負が赤字)',
    kind: 'number',
    series: [
      {
        key: 'federalDeficit',
        label: '財政収支',
        color: COLORS.federalDeficit,
        indicatorId: 'federal-deficit',
      },
    ],
    notes: [
      <span key="why">
        <strong>財政赤字の拡大は国債発行を増やし、長期金利の上昇要因になる。</strong>
        金利が上がると株式の理論値が下がるため、バリュエーションに効く。
      </span>,
      <span key="seasonal">
        <strong>季節調整されていない</strong>ため月ごとの振れが大きい。
        4 月は確定申告の納税で黒字になりやすいなど、月の性質を踏まえて読む。
      </span>,
      <span key="monthly">
        月次なので、週次の金利・スプレッドとは動きの速さが違う。
        <strong>先月からの変化として読む</strong>こと。
      </span>,
    ],
  },
  {
    question: 'financial',
    frequency: 'monthly',
    primaryIndicator: 'ten-year-bid-to-cover',
    title: '10年債入札の応札倍率',
    subtitle: '応札額 ÷ 落札額。低いほど買い手が弱い',
    kind: 'number',
    zeroLine: false,
    series: [
      {
        key: 'bidToCover',
        label: '応札倍率',
        color: COLORS.bidToCover,
        indicatorId: 'ten-year-bid-to-cover',
      },
    ],
    notes: [
      <span key="why">
        <strong>財政収支 (上の図) の下流にあたる。</strong>
        赤字が増えると国債の発行が増え、その国債を買う需要が弱ければ利回りが上がる。
        <strong>応札倍率が下がるのは需要が弱い合図</strong>で、金利上昇圧力になる。
      </span>,
      <span key="no-threshold">
        <strong>「低調」の線は引いていない。</strong>
        どこから低調かに定説が無く恣意的になるため (VIX・イールドスプレッドと同じ判断)。
        過去の水準と比べて読むこと。
      </span>,
      <span key="series">
        <strong>10 年債の通常債のみ。</strong>
        リオープン (追加発行) は残存期間で記録されるため発行時の年限で絞り、
        <strong>10 年 TIPS は除いている</strong>。どちらか一方でも欠けると別物が混ざる
        (判断の記録は ADR-0006)。
      </span>,
      <span key="irregular">
        入札は月 1 回だが日付は月ごとに動くため、<strong>その月の入札結果</strong>として
        載せている。出所は米財務省 Fiscal Data (FRED ではない)。
      </span>,
    ],
  },
  {
    question: 'risk',
    frequency: 'daily',
    primaryIndicator: 'vix',
    title: 'VIX',
    subtitle: 'S&P 500 のインプライド・ボラティリティ指数',
    series: [{ key: 'vix', label: 'VIX', color: COLORS.vix }],
    notes: [
      <span key="weekly">
        <strong>日次 (終値)。</strong>
        週の途中の急騰も図に出る。ただし日中の高値・安値は持っていないので、
        ザラ場の変動を追う用途には向かない。
      </span>,
      <span key="no-guide">
        水準の目安となる補助線は引いていない。閾値の置き方に定説が無く、恣意的な基準を
        示すことになるため。
      </span>,
    ],
  },
  {
    question: 'risk',
    frequency: 'daily',
    primaryIndicator: 'dollar-index',
    title: 'ドル指数 (実効為替)',
    subtitle: '主要通貨に対するドルの総合的な強さ (Jan 2006 = 100)',
    series: [{ key: 'dollarIndex', label: 'ドル指数', color: COLORS.dollarIndex }],
    notes: [
      <span key="vs-usdjpy">
        <strong>USD/JPY とは別物。</strong>
        あちらは円との 2 国間レート、こちらは貿易額で加重した総合指標。
        円だけ動いてもドル指数はあまり動かない。
      </span>,
      <span key="impact">
        ドル高は米企業の海外売上をドル換算で目減りさせるため、S&P 500 の業績に効く。
        リスク回避局面ではドルが買われやすい。
      </span>,
    ],
  },
  {
    question: 'drawdown',
    frequency: 'weekly',
    primaryIndicator: 'etf-spy',
    drawdownGroup: 'major',
    title: '主要資産の下落率',
    subtitle: '最高値から何 % 下げているか。指数・金・長期国債・REIT',
    notes: [
      <span key="why">
        <strong>水準が違う資産を同じ軸に載せるための正規化。</strong>
        金 (400 ドル) と S&P 500 ETF (770 ドル) は水準では比べられないが、
        下落率なら並べられる。<strong>上に行くほど最高値に近い</strong> (軸を反転している)。
      </span>,
      <span key="baseline">
        <strong>最高値は「観測を始めてからの最大値」で、史上最高値ではない。</strong>
        起点は 2024-11-28。それ以前に付けた高値は含まない。
      </span>,
      <span key="source">
        ETF の価格を使っている。<strong>指数そのものではない</strong>ため、
        信託報酬の分だけ長期では指数から目減りする。出所は Finnhub。
      </span>,
    ],
  },
  {
    question: 'drawdown',
    frequency: 'weekly',
    primaryIndicator: 'etf-vgt',
    drawdownGroup: 'sector',
    title: '米国セクターの下落率',
    subtitle: 'どのセクターから資金が抜けているか',
    notes: [
      <span key="rotation">
        <strong>セクターの順位が入れ替わるのがローテーション。</strong>
        景気が減速する局面では生活必需品・公益が相対的に強く、一般消費財・金融が先に売られる
        傾向があるが、<strong>毎回そうなるとは限らない</strong>。
      </span>,
      <span key="etf">
        Vanguard のセクター ETF。<strong>S&P 500 のセクター指数そのものではない</strong>
        (S&P DJI の著作権で無料取得の経路が無いため)。構成銘柄と組入比率が違う。
      </span>,
    ],
  },
  {
    question: 'drawdown',
    frequency: 'weekly',
    primaryIndicator: 'etf-uso',
    drawdownGroup: 'commodity',
    title: 'コモディティの下落率',
    subtitle: '原油・金属・穀物',
    notes: [
      <span key="roll">
        <strong>現物価格ではない。</strong>
        先物を乗り換える ETF はロールコストで長期に減価する。
        <strong>USO と UNG は特に大きい</strong>ので、水準そのものを商品価格として読まないこと。
      </span>,
      <span key="chain">
        原油は物価の起点でもある。「物価は落ち着くか」(経済ページ) の WTI と合わせて読む。
      </span>,
    ],
  },
  {
    question: 'drawdown',
    frequency: 'weekly',
    primaryIndicator: 'etf-eem',
    drawdownGroup: 'country',
    title: '各国の下落率',
    subtitle: '米国の下落が世界共通か固有かを見分ける',
    notes: [
      <span key="why">
        <strong>ドル建ての ETF なので現地通貨ベースの騰落とは一致しない。</strong>
        現地株が上がっても通貨が下がれば下落率は悪化する。為替の影響を含んだ数字。
      </span>,
      <span key="pair">
        金利の国際比較 (「金融環境は緩いか厳しいか」) と同じ狙い。
        <strong>揃って下げていれば世界共通の要因</strong>、1 国だけなら固有の事情と読める。
      </span>,
    ],
  },
  {
    question: 'risk',
    frequency: 'daily',
    primaryIndicator: 'etf-gld',
    title: 'ゴールド (GLD)',
    subtitle: '金 ETF の終値 (ドル/株)。現物価格ではない',
    series: [{ key: 'gold', label: 'GLD', color: COLORS.gold }],
    notes: [
      <span key="why">
        <strong>リスク回避で買われやすい。</strong>
        株式と逆に動く局面があるため、VIX や信用スプレッドと合わせて市場心理を読む。
        実質金利が上がると金の相対的な魅力は下がる (金利を生まないため)。
      </span>,
      <span key="not-spot">
        <strong>金の現物価格ではない。</strong>
        FRED は 2022 年 1 月に現物価格 (LBMA) の提供を終了しており、無料で取れる経路が無い。
        金を裏付けとする ETF の価格で代替している。
        <strong>GLD 1 株はおよそ金 1/10 オンス</strong>だが、
        <strong>信託報酬 (年約 0.4%) の分だけ長期では現物から目減りする</strong>ので、
        水準そのものを金価格として読まないこと。
      </span>,
      <span key="source">
        出所は Finnhub の日次終値。<strong>2026-06-08 より前は取れない。</strong>
        stockanalysis.com の履歴ページから遡って取り込んだが、
        サーバー側で返るのは直近 50 営業日ぶんだけだったため。
        それ以前は無料で取得できる経路が無い。
      </span>,
    ],
  },
];

/**
 * 市場ページ (#89)。旧 `/macro`。
 *
 * 景気そのものを見る指標は経済ページに移し、ここには
 * **金融環境 (借りやすさ・金利) と市場心理**だけを残している。
 */
export default function MarketPage() {
  return (
    // モバイルは間隔を詰める。1 画面目に「最新の状況」まで入れるため (#75)。
    <div className="space-y-10 sm:space-y-16">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">市場</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          金融環境と市場心理。景気そのものを見る指標は「経済」に置いている。
        </p>
        <QuestionIndex charts={CHARTS} questions={MARKET_QUESTIONS} />
      </div>

      {/* 期間フィルターに依存せず常に直近の値を見せる。 */}
      <MarketSummary points={macro} />

      <QuestionSections dailyPoints={marketDaily} charts={CHARTS} questions={MARKET_QUESTIONS} />
    </div>
  );
}