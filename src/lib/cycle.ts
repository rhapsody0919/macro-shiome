/**
 * 景気サイクルに対する位置の表示名 (#62 / #89)。
 *
 * 指標は増え続ける前提なので、**分類は指標マスタが持ち、画面は引くだけ**にする。
 * 画面側に分類を書くと、指標を足すたびに 2 か所を直すことになる。
 *
 * #89 でセクション分けの軸を「問い」に変えたため、分類はセクション見出しではなく
 * **各チャートのバッジ**に出す。分類自体は判断に効く (先行なら先を示す、
 * 一致なら既に転換している可能性がある) ので捨てない。
 */
import type { CyclePosition } from './data/types';

export interface CycleMeta {
  label: string;
  /** 分類の意味。バッジの説明 (title 属性) に使う。 */
  description: string;
}

export const CYCLE_META: Record<CyclePosition, CycleMeta> = {
  leading: {
    label: '先行',
    description: '景気の転換に先立って動く。The Conference Board の景気先行指数 (LEI) の構成要素。',
  },
  coincident: {
    label: '一致',
    description:
      '景気とほぼ同時に動く。悪化が見えた時点で既に転換している可能性がある (同 CEI の構成要素)。',
  },
  lagging: {
    label: '遅行',
    description: '景気の転換に遅れて動く。転換の確認に使う (同 LAG の構成要素)。',
  },
};
