import { CYCLE_META } from '@/lib/cycle';
import type { CyclePosition, Frequency } from '@/lib/data/types';

/**
 * チャートに付ける属性バッジ (#89)。
 *
 * セクションの見出しを「問い」にした結果、**更新頻度と景気サイクルの分類が
 * 見出しから読み取れなくなった**。この 2 つは判断に必要なのでバッジで残す。
 *
 * - 頻度: 「先週から動いていない」のか「月次だから動かない」のかを判別するため (#64)
 * - サイクル: 先行なら先を示し、一致なら既に転換している可能性がある (#62)
 */

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: '日次',
  weekly: '週次',
  monthly: '月次',
};

const BADGE = 'rounded border px-1.5 py-0.5 text-[10px] whitespace-nowrap';
const NEUTRAL = 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400';

/** 先行だけ色を変える。「先を示す」ことが判断上いちばん効くため。 */
const CYCLE_STYLES: Record<CyclePosition, string> = {
  leading: 'border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300',
  coincident: NEUTRAL,
  lagging: NEUTRAL,
};

export function Badges({
  frequency,
  cyclePosition,
}: {
  /** 表示上の更新頻度。日次系列でも週次グリッドに載せていれば 'weekly' を渡す。 */
  frequency: Frequency;
  /** 指標マスタに分類が無ければ省く。無い分類を作らない (#62)。 */
  cyclePosition?: CyclePosition;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`${BADGE} ${NEUTRAL}`}>{FREQUENCY_LABELS[frequency]}</span>
      {cyclePosition !== undefined && (
        <span
          className={`${BADGE} ${CYCLE_STYLES[cyclePosition]}`}
          title={CYCLE_META[cyclePosition].description}
        >
          {CYCLE_META[cyclePosition].label}
        </span>
      )}
    </span>
  );
}
