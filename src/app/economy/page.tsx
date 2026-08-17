import { PriceChainChart } from '@/components/charts/price-chain';
import { CYCLE_SECTIONS } from '@/lib/cycle';
import { economy } from '@/lib/data/loader';

export const metadata = {
  title: '経済統計 | macro-shiome',
};

/**
 * 経済統計 (月次) の画面 (#64)。
 *
 * **市場データ (`/macro`) と分けている。** 更新頻度が違うため。
 * 週次の市場データは毎週動くが、経済統計は月 1 回しか動かない。同じページに置くと
 * 「先週から動いていない」のか「月次だから動かない」のか読み手が判別できない。
 *
 * セクションは `/macro` と同じく景気サイクルに対する位置で分ける。
 * 現時点では物価のみで、分類に当てはまらないため「その他」に入る。
 * 先行・一致のセクションは #65 (住宅) / #66 (労働・所得・消費) で埋まる。
 */
export default function EconomyPage() {
  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-xl font-bold">経済統計</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          月次で発表される経済指標。市場データ (マクロ指標) とは更新頻度が違うためページを分けている。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <strong>横軸は「対象月」であり発表日ではない。</strong>
          経済統計は対象月の翌月以降に発表されるため、直近 1〜2 か月分はまだ出ていない。
        </p>
      </div>

      <section className="space-y-8">
        <header className="border-b border-slate-200 pb-2 dark:border-slate-800">
          <h2 className="text-lg font-bold">{CYCLE_SECTIONS.unclassified.label}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {CYCLE_SECTIONS.unclassified.description}
          </p>
        </header>

        <PriceChainChart view={economy} />
      </section>
    </div>
  );
}
