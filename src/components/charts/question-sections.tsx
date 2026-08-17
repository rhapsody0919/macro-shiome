import { Suspense, type ReactNode } from 'react';
import { MacroChart, type SeriesDef } from './macro-chart';
import { MonthlyChart, type MonthlySeriesDef } from './monthly-chart';
import { Badges } from './badges';
import type { ValueKind } from './chart-frame';
import { indicators } from '@/lib/data/indicators';
import { economy, macro } from '@/lib/data/loader';
import { groupByQuestion, type Question } from '@/lib/questions';

/**
 * 「問い」でセクションを分けてチャートを並べる (#89)。
 *
 * **週次と月次を同じセクションに混ぜる。** 「景気は減速しているか」に答えるには
 * 週次の新規求人と月次の新規受注の両方が要る。更新頻度でページを分けた #64 の判断は
 * ここで撤回し、代わりに**各チャートのバッジ**で頻度を示す。
 * 「先週から動いていない」のか「月次だから動かない」のかは、そこで判別できる。
 */

interface ChartBase<K extends string> {
  /** どの問いに属するか。 */
  question: K;
  /** 景気サイクルの分類 (バッジ) の引き元。複数指標を束ねる場合は主となる指標を指す。 */
  primaryIndicator: string;
  title: string;
  subtitle: string;
  notes: ReactNode[];
}

/**
 * チャート定義。データ源が違うので週次と月次で形が違う。
 *
 * 判別は `frequency` で行う。バッジの表示にも同じ値を使うため、
 * 「どちらのコンポーネントで描くか」と「何と表示するか」がずれない。
 */
export type QuestionChartDef<K extends string> =
  | (ChartBase<K> & {
      frequency: 'weekly';
      kind?: ValueKind;
      /** 符号が意味を持つ指標か。ゼロ線を引き負の領域を塗る。 */
      signed?: boolean;
      /** 定義から決まる基準線。恣意的な閾値には使わない。 */
      baseline?: { value: number; label: string };
      series: SeriesDef[];
    })
  | (ChartBase<K> & {
      frequency: 'monthly';
      kind?: ValueKind;
      zeroLine?: boolean;
      series: MonthlySeriesDef[];
    });

/**
 * 景気サイクルの分類を指標マスタから引く。
 *
 * **未知の ID はエラーにする**。黙って無分類にすると、指標マスタから消えた指標を
 * 画面が指し続けても気付けない。静的生成なのでビルド時に落ちる。
 */
function cycleOf<K extends string>(chart: QuestionChartDef<K>) {
  const indicator = indicators[chart.primaryIndicator];
  if (indicator === undefined) {
    throw new Error(`問いセクション: 指標マスタに無い ID を参照している (${chart.primaryIndicator})`);
  }
  return indicator.cyclePosition;
}

/** 見出しへのアンカー。問いの ID をそのまま使う。 */
export function questionAnchor(id: string): string {
  return `q-${id}`;
}

export function QuestionSections<K extends string>({
  charts,
  questions,
}: {
  charts: readonly QuestionChartDef<K>[];
  questions: Record<K, Question>;
}) {
  // 空の問いは出さない。指標が増えれば自動で現れる。
  const groups = groupByQuestion(charts, questions, (chart) => chart.question);

  return (
    <>
      {groups.map((group) => (
        <section key={group.id} id={questionAnchor(group.id)} className="space-y-10">
          <header className="border-b border-slate-200 pb-2 dark:border-slate-800">
            <h2 className="text-lg font-bold">{group.question.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{group.question.guide}</p>
          </header>

          {/* useSearchParams (期間フィルター) を使うため静的生成時は Suspense で包む。 */}
          {group.items.map((chart) => (
            <Suspense key={chart.title} fallback={<div className="h-72 sm:h-96" />}>
              {chart.frequency === 'weekly' ? (
                <MacroChart
                  points={macro}
                  title={chart.title}
                  subtitle={chart.subtitle}
                  kind={chart.kind}
                  signed={chart.signed}
                  baseline={chart.baseline}
                  series={chart.series}
                  notes={chart.notes}
                  badges={<Badges frequency="weekly" cyclePosition={cycleOf(chart)} />}
                />
              ) : (
                <MonthlyChart
                  view={economy}
                  title={chart.title}
                  subtitle={chart.subtitle}
                  kind={chart.kind}
                  zeroLine={chart.zeroLine}
                  series={chart.series}
                  notes={chart.notes}
                  badges={<Badges frequency="monthly" cyclePosition={cycleOf(chart)} />}
                />
              )}
            </Suspense>
          ))}
        </section>
      ))}
    </>
  );
}

/**
 * ページ先頭に置く問いの目次。
 *
 * 問いが 5 つ並ぶとモバイルでは全体像が見えないため、
 * 「何に答えられるページか」を先に示し、該当セクションへ飛べるようにする。
 */
export function QuestionIndex<K extends string>({
  charts,
  questions,
}: {
  charts: readonly QuestionChartDef<K>[];
  questions: Record<K, Question>;
}) {
  const groups = groupByQuestion(charts, questions, (chart) => chart.question);

  return (
    <nav aria-label="このページで答える問い" className="flex flex-wrap gap-2">
      {groups.map((group) => (
        <a
          key={group.id}
          href={`#${questionAnchor(group.id)}`}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {group.question.title}
        </a>
      ))}
    </nav>
  );
}
