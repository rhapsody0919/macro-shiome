import Link from 'next/link';
import { indicators } from '@/lib/data/indicators';
import type { CopyrightClass } from '@/lib/data/types';

export const metadata = {
  title: '利用規約・データの出所 | macro-shiome',
};

/** 出所ごとに指標をまとめる。指標が増えても自動で反映される。 */
function groupByAttribution(): Array<{
  attribution: string;
  copyright: CopyrightClass;
  names: string[];
}> {
  const map = new Map<string, { attribution: string; copyright: CopyrightClass; names: string[] }>();

  for (const indicator of Object.values(indicators)) {
    const entry = map.get(indicator.attribution);
    if (entry === undefined) {
      map.set(indicator.attribution, {
        attribution: indicator.attribution,
        copyright: indicator.copyright,
        names: [indicator.name],
      });
    } else {
      entry.names.push(indicator.name);
      // 同じ出所に区分が混在する場合は厳しい方に寄せる。
      if (indicator.copyright === 'restricted') entry.copyright = 'restricted';
    }
  }

  return [...map.values()].sort((a, b) => a.attribution.localeCompare(b.attribution));
}

export default function TermsPage() {
  const sources = groupByAttribution();

  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-bold">利用規約・データの出所</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          本サイトが表示する数値の出所と、利用にあたっての条件をまとめています。
        </p>
      </header>

      <Section title="FRED API の利用について">
        {/* FRED 規約が必須としている文言。文面は変更しない。 */}
        <p className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700">
          This product uses the FRED® API but is not endorsed or certified by the Federal Reserve
          Bank of St. Louis.
        </p>
        <p>
          本サイトは St. Louis 連邦準備銀行が提供する FRED® API を利用しています。
          <strong>
            本サイトを利用することにより、利用者は FRED® API の利用規約に同意したものとみなされます。
          </strong>
        </p>
        <p>
          <ExternalLink href="https://fred.stlouisfed.org/docs/api/terms_of_use.html">
            FRED® API Terms of Use
          </ExternalLink>
        </p>
      </Section>

      <Section title="日本銀行 API の利用について">
        {/* 日本銀行が API 機能利用時の留意点として必須としている文言。文面は変更しない。 */}
        <p className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700">
          このサービスは、日本銀行時系列統計データ検索サイトの API 機能を使用しています。
          サービスの内容は日本銀行によって保証されたものではありません。
        </p>
      </Section>

      <Section title="データの出所">
        <p>
          本サイトは分析記事の転載ではなく、下記のデータ提供元から取得した数値をもとに表示しています。
        </p>
        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.attribution}
              className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{source.attribution}</span>
                {source.copyright === 'restricted' && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    著作権あり
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {source.names.join(' / ')}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          「著作権あり」の系列は提供元に著作権があります。S&amp;P 500 は S&amp;P Dow Jones Indices
          LLC、NASDAQ-100 は Nasdaq, Inc.、業績関連の指標は FactSet Research Systems Inc.
          に帰属します。stockanalysis.com のデータは同社の利用規約に従い、出所を明記して利用しています。
        </p>
        <p className="text-xs text-slate-500">
          データ提供元から要請があった場合、該当する系列の公開を停止します。
        </p>
      </Section>

      <Section title="数値の定義と注意">
        <Definition term="EPS はすべて導出値です">
          EPS の絶対値を無料で取得できる経路が存在しないため、<strong>指数 ÷ PER</strong>{' '}
          で算出しています。PER と同一時点の終値を使うことで時点のずれを避けていますが、PER
          が小数第 1 位までのため 0.2〜0.5% 程度の誤差を含みます。
        </Definition>

        <Definition term="理論値と割高率は FactSet 掲載の終値と比べています">
          S&amp;P 500 の実績 EPS は FactSet レポートの終値 ÷ 同レポートの PER で作るため、
          <strong>割高率もその終値と比べます</strong>。レポート掲載の終値は発行日の
          <strong>前営業日</strong>の値なので、他の画面が出す指数 (金曜終値) とは
          1 営業日ずれます。指数と比べると、EPS の基準日と指数の日付が食い違い、
          実測で最大 2.7% の差が割高率に乗っていました。NASDAQ-100 は指数そのものから
          EPS を作るため、このずれは生じません。
        </Definition>

        <Definition term="PER は as-reported (GAAP) ベースです">
          一般的な投資レポートで使われる operating (継続事業) ベースとは
          <strong>約 9% ずれます</strong>
          。同じ指数でも他の情報源と数値が食い違って見えるのはこのためです。どちらが正しいという話ではなく、定義が異なります。
        </Definition>

        <Definition term="NASDAQ-100 の PER は ETF 由来です">
          指数そのものの PER を無料で取得できないため、連動 ETF (QQQ) の PER を使っています。
          指数の PER とは厳密には一致しません。また予想 PER は取得経路が無いため、NASDAQ-100
          では予想 EPS を表示できません。
        </Definition>

        <Definition term="イールドスプレッドは実質金利ベースです">
          株式益回り − <strong>実質金利</strong> (10 年債利回り − 期待インフレ率) で算出しています。
          名目金利で計算すると別の値になります。
        </Definition>

        <Definition term="理論値と割高率は設定に依存する試算値です">
          理論値 = 実績 EPS ÷ 基準益回り で算出しています。基準益回りは外部から取得できる値ではなく、
          成長率見通しに基づく<strong>裁量パラメータ</strong>
          です。設定を変えれば結果も変わるため、客観的な絶対値ではありません。画面には常に設定値を表示しています。
        </Definition>

        <Definition term="欠測は補完していません">
          データが取得できなかった週はチャートの線を繋いでいません。滑らかに見せるより、
          欠けていることが分かる方が正しいと考えているためです。
        </Definition>
      </Section>

      <Section title="免責">
        <p>
          <strong>本サイトは指標の提示のみを行い、投資助言ではありません。</strong>
          特定の銘柄や商品の売買を推奨するものではなく、投資判断は利用者自身の責任で行ってください。
        </p>
        <p>
          データの正確性・完全性・最新性について保証しません。取得元の仕様変更や障害により、
          誤った値が表示される、または更新が滞る可能性があります。
        </p>
        <p>本サイトの利用によって生じたいかなる損害についても、運営者は責任を負いません。</p>
      </Section>

      <Section title="更新頻度">
        <p>
          データは毎日 (日本時間 午前11時ごろ) に自動取得しています。日中の値動きは反映されません。
          最終更新日時は各ページのヘッダーに表示しています。
        </p>
      </Section>

      <p className="text-sm">
        <Link href="/" className="underline">
          バリュエーション画面へ戻る
        </Link>
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold">{term}</div>
      <p className="text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children} ↗
    </a>
  );
}
