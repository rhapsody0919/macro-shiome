/**
 * 下落率チャートの資産グループ (#128)。
 *
 * **指標マスタには置かない。** マスタが持つ `group` は取得層の分類 (equity / rates …) で、
 * こちらは画面の並べ方。37 本を 1 枚に重ねると読めないため 4 枚に分ける。
 */
export const DRAWDOWN_GROUPS = {
  major: {
    title: '主要資産',
    guide: '指数・金・長期国債・REIT。まず全体としてどこが売られているかを見る。',
  },
  sector: {
    title: '米国セクター',
    guide: 'どのセクターから資金が抜けているか。景気局面によって順番が変わる。',
  },
  commodity: {
    title: 'コモディティ',
    guide: '実需と供給の変化。原油は物価の起点でもある。',
  },
  country: {
    title: '各国',
    guide: '米国の下落が世界共通か、その国固有かを見分ける。',
  },
} as const;

export type DrawdownGroup = keyof typeof DRAWDOWN_GROUPS;

/** 指標 ID → グループ。並び順は各グループ内での表示順。 */
export const DRAWDOWN_ASSETS: Array<{ id: string; group: DrawdownGroup }> = [
  ...['etf-spy', 'etf-qqq', 'etf-vti', 'etf-vig', 'etf-gld', 'etf-gdx', 'etf-vglt', 'etf-vnq', 'etf-iwm'].map(
    (id) => ({ id, group: 'major' as const }),
  ),
  ...['etf-vgt', 'etf-vcr', 'etf-vfh', 'etf-vht', 'etf-vaw', 'etf-vde', 'etf-vdc', 'etf-vpu'].map(
    (id) => ({ id, group: 'sector' as const }),
  ),
  ...['etf-uso', 'etf-ung', 'etf-copx', 'etf-slx', 'etf-remx', 'etf-corn', 'etf-weat'].map((id) => ({
    id,
    group: 'commodity' as const,
  })),
  ...['etf-eem', 'etf-ewj', 'etf-epi', 'etf-ewu', 'etf-ewg', 'etf-ewz', 'etf-vnm', 'etf-eww', 'etf-mchi', 'etf-eido', 'etf-thd', 'etf-gxg', 'etf-smin'].map(
    (id) => ({ id, group: 'country' as const }),
  ),
];
