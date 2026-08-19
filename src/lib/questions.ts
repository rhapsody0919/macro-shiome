/**
 * 画面のセクションを「問い」で分ける (#89)。
 *
 * **「先行指標」では何に使うか分からない。** 指標が 55 件に増えた結果、
 * 景気サイクルによる分類 (#62) では「その他の指標」が最大セクションになり、
 * 分類が機能しなくなった。投資判断で見る指標の大半は景気指数の構成要素ではないため。
 *
 * 見出しを**問い**にすると「いつ何を見るか」がそのまま伝わる。
 * 景気サイクルの分類は捨てず、**各チャートのバッジ**に移して残す。
 */

export interface Question {
  /** セクションの見出しになる問い。 */
  title: string;
  /**
   * 「こういう時に見る」の 1 文。
   *
   * 問いだけでは何を読み取るかまでは伝わらないため、読み方の指針を添える。
   */
  guide: string;
}

/** 経済ページの問い。上流 (先を示す) から下流 (結果) の順に並べる。 */
export const ECONOMY_QUESTIONS = {
  slowdown: {
    title: '景気は減速しているか',
    guide:
      'ここが崩れると企業業績と株価に効く。求人・受注のような上流が先に動き、生産や雇用は後から追う。',
  },
  labor: {
    title: '雇用と所得は保つか',
    guide:
      '所得は消費の源泉。ただし雇用は景気に対して「一致」で、悪化が見えた時点で既に転換している可能性がある。',
  },
  consumption: {
    title: '消費は続くか',
    guide:
      '米国 GDP の約 7 割が個人消費。所得が伸びなくても貯蓄を取り崩せば消費は保つが、取り崩しには限界がある。',
  },
  prices: {
    title: '物価は落ち着くか',
    guide:
      '上流から下流に伝わるので、原油と輸入物価が先に動く。物価が高いと金利が下がらず、株式の理論値が上がらない。',
  },
  housing: {
    title: '住宅は動いているか',
    guide: '金利に最も敏感な分野。金利上昇の影響がここに先に出る。許可 → 着工 → 販売の順に進む。',
  },
} as const satisfies Record<string, Question>;

/** 市場ページの問い。 */
export const MARKET_QUESTIONS = {
  financial: {
    title: '金融環境は緩いか厳しいか',
    guide:
      '金利が高いと経済成長・企業業績・個人消費のすべてが抑制される。株式の理論値も金利で決まる。',
  },
  risk: {
    title: '市場は不安か',
    guide: '投資家心理の振れ。実体経済より先に動くことも、過剰反応で終わることもある。',
  },
  drawdown: {
    title: 'いまどの資産が売られているか',
    guide:
      '最高値からの下落率で揃えると、水準の違う資産を横断して比べられる。どこから資金が抜けているかが順位で分かる。',
  },
} as const satisfies Record<string, Question>;

/**
 * 日本ページの問い (#152)。
 *
 * **ページを地域で分けた唯一の例外。** 他のページは対象 (バリュエーション / 経済 / 市場) で
 * 分けているが、日本の指標は出所も単位も米国と違い、同じ問いの中に混ぜると
 * 「単位が違う」のか「動きが違う」のかを読み分けられない (#116〜#118 と同じ型)。
 * e-Stat から日本の指標を増やしていく方針のため、分散が広がる前に分けた。
 *
 * **国際比較のチャートはここに置かない。** 「10年債利回りの国際比較」(日米独) と
 * 「各国の下落率」は複数国を並べること自体が目的で、日本ページに置くと何を見る図か
 * 分からなくなる。
 */
export const JAPAN_QUESTIONS = {
  'jp-cycle': {
    title: '日本の景気は減速しているか',
    guide:
      '内閣府の景気動向指数。先行 → 一致 → 遅行の順に動くため、3 本の位置関係そのものが局面を示す。',
  },
  'jp-price': {
    title: '日本の物価は落ち着くか',
    guide:
      '日銀の政策判断に直結する。物価が上がれば利上げ観測が強まり、金利・円相場・日経平均に順に効く。',
  },
  'jp-labor': {
    title: '日本の雇用と所得は保つか',
    guide:
      '求人は雇用の先行、実質賃金は家計の購買力。物価が賃金を上回れば、名目が増えても消費は伸びない。',
  },
  'jp-trade': {
    title: '輸入コストは日本を圧迫しているか',
    guide:
      '輸入物価が輸出物価より速く上がると、稼いだ分が海外に流出する。円安は輸出企業の売上を押し上げる一方で、この経路では国内の負担になる。',
  },
  'jp-market': {
    title: '日本市場はどう動いているか',
    guide: '株と為替は連動しやすい。円安は輸出企業の円換算の売上を押し上げる。',
  },
  'jp-housing': {
    title: '日本の住宅は動いているか',
    guide:
      '米国のように金利で先行して動く構造ではない。人口と税制の影響が大きく、持家と貸家で動く理由が違う。',
  },
} as const satisfies Record<string, Question>;

export type EconomyQuestionId = keyof typeof ECONOMY_QUESTIONS;
export type MarketQuestionId = keyof typeof MARKET_QUESTIONS;
export type JapanQuestionId = keyof typeof JAPAN_QUESTIONS;

/**
 * 問いごとに項目を束ねる。**空の問いは返さない**。
 *
 * 表示順は定義順。上流から下流へ並べているため、順序自体が意味を持つ。
 */
export function groupByQuestion<T, K extends string>(
  items: readonly T[],
  questions: Record<K, Question>,
  questionOf: (item: T) => K,
): Array<{ id: K; question: Question; items: T[] }> {
  return (Object.keys(questions) as K[])
    .map((id) => ({
      id,
      question: questions[id],
      items: items.filter((item) => questionOf(item) === id),
    }))
    .filter((group) => group.items.length > 0);
}
