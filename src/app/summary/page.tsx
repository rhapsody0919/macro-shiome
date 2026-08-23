import { summary } from '@/lib/data/loader';
import { formatDate, formatNumber, formatSigned } from '@/lib/format';
import type { SectorHighlight, WarningSignal } from '@/lib/data/types';

export const metadata = {
  title: 'AI要約 | macro-shiome',
};

/**
 * AI要約ページ (#279)。
 *
 * 「経済はどのような状態か」「注意が必要なことはあるか」「狙い目なセクター/ETFはあるか」
 * の3つの問いに答える。**数値はすべてコードが直接描画し、LLM生成テキスト (`note`) は
 * 数値を含まない接続的な説明にとどめる** (投資家×エンジニアの議論で合意した設計)。
 */
export default function SummaryPage() {
  return (
    <article className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-xl font-bold">AI要約</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          指標データから機械的に判定した状態を、AIが言語化したもの。数値・判定はすべてコードが
          計算しており、AIは接続的な説明文だけを書いている。
        </p>
        <p className="mt-1 text-xs text-slate-500">
          最終生成 {formatDate(summary.generatedAt.slice(0, 10))}
        </p>
      </header>

      <section aria-labelledby="economy-state">
        <h2 id="economy-state" className="text-lg font-semibold">
          経済はどのような状態か
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          {summary.economyState ?? 'まだ生成されていない。'}
        </p>
      </section>

      <section aria-labelledby="warnings">
        <h2 id="warnings" className="text-lg font-semibold">
          注意が必要なことはあるか
        </h2>
        {summary.warnings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            該当する警告シグナルは無い。
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {summary.warnings.map((warning) => (
              <WarningItem key={warning.id} warning={warning} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="highlights">
        <h2 id="highlights" className="text-lg font-semibold">
          狙い目なセクター/ETFはあるか
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          下落率が深く (上位1/3以内)、かつSPYに対する相対強度がプラス、またはブレイクアウト
          検出のどちらかが重なった銘柄。推奨ではなく、複数シグナルの重なりという事実の提示。
        </p>
        {summary.highlights.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">該当する銘柄は無い。</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {summary.highlights.map((highlight) => (
              <HighlightItem key={highlight.id} highlight={highlight} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function WarningItem({ warning }: { warning: WarningSignal }) {
  return (
    <li className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-semibold">{warning.label}</span>
        <span className="text-xs tabular-nums text-slate-500">{formatNumber(warning.value)}</span>
        {warning.percentile !== null && (
          <span className="text-xs text-slate-500">
            (過去5年で{warning.percentile >= 50 ? '上位' : '下位'}
            {formatNumber(
              warning.percentile >= 50 ? 100 - warning.percentile : warning.percentile,
              0,
            )}
            %)
          </span>
        )}
        <span className="text-[11px] text-slate-400">{formatDate(warning.date)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {warning.note ?? 'AIによる説明はまだ生成されていない。'}
      </p>
    </li>
  );
}

function HighlightItem({ highlight }: { highlight: SectorHighlight }) {
  return (
    <li className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-semibold">{highlight.name}</span>
        <span className="text-xs tabular-nums text-slate-500">
          下落率 {formatNumber(highlight.drawdown, 1)}%
        </span>
        <span className="text-xs tabular-nums text-slate-500">
          対SPY {formatSigned(highlight.relativeStrength, 1)}%
        </span>
        {highlight.hasBreakout && (
          <span className="text-xs text-slate-500">ブレイクアウト検出あり</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {highlight.note ?? 'AIによる説明はまだ生成されていない。'}
      </p>
    </li>
  );
}
