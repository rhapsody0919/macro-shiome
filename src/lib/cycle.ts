/**
 * 景気サイクルに対する位置のセクション分け (#62)。
 *
 * 指標は増え続ける前提なので、**分類は指標マスタが持ち、画面は引くだけ**にする。
 * 画面側に分類を書くと、指標を足すたびに 2 か所を直すことになる。
 */
import type { CyclePosition } from './data/types';

/** 表示順。先行 → 一致 → 遅行 → 分類なし。 */
export const CYCLE_ORDER = ['leading', 'coincident', 'lagging', 'unclassified'] as const;

export type CycleSection = (typeof CYCLE_ORDER)[number];

export interface CycleSectionMeta {
  label: string;
  /** そのセクションが何を意味するか。読み手が順序の意味を掴めるようにする。 */
  description: string;
}

export const CYCLE_SECTIONS: Record<CycleSection, CycleSectionMeta> = {
  leading: {
    label: '先行指標',
    description: '景気の転換に先立って動く。The Conference Board の景気先行指数 (LEI) の構成要素。',
  },
  coincident: {
    label: '一致指標',
    description:
      '景気とほぼ同時に動く。悪化が見えた時点で既に転換している可能性がある (同 CEI の構成要素)。',
  },
  lagging: {
    label: '遅行指標',
    description: '景気の転換に遅れて動く。転換の確認に使う。',
  },
  unclassified: {
    label: 'その他の指標',
    description:
      '景気サイクルの尺度として定義されていない指標。先行・遅行の分類には当てはまらない。',
  },
};

/**
 * 項目をセクションごとに束ねる。**空のセクションは返さない**。
 *
 * 指標がまだ少ない段階で空の見出しだけが並ぶと、壊れているように見えるため。
 */
export function groupByCycle<T>(
  items: readonly T[],
  positionOf: (item: T) => CyclePosition | undefined,
): Array<{ section: CycleSection; meta: CycleSectionMeta; items: T[] }> {
  return CYCLE_ORDER.map((section) => ({
    section,
    meta: CYCLE_SECTIONS[section],
    items: items.filter((item) => (positionOf(item) ?? 'unclassified') === section),
  })).filter((group) => group.items.length > 0);
}
