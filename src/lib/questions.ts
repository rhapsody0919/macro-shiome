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
  overseas: {
    title: '海外市場も同じ方向か',
    guide:
      '米国だけが動いているのか、世界的な流れなのかを見る。日本市場は為替と株が連動しやすい。',
  },
} as const satisfies Record<string, Question>;

export type EconomyQuestionId = keyof typeof ECONOMY_QUESTIONS;
export type MarketQuestionId = keyof typeof MARKET_QUESTIONS;

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
