import { Suspense, type ReactNode } from 'react';
import { MacroChart, type SeriesDef } from './macro-chart';
import { DrawdownChart } from './drawdown-chart';
import { HighTightFlagList } from './high-tight-flag-list';
import { CupWithHandleList } from './cup-with-handle-list';
import { DoubleBottomList } from './double-bottom-list';
import { HeadAndShouldersBottomList } from './head-and-shoulders-bottom-list';
import { DRAWDOWN_PALETTE } from '@/lib/colors';
import {
  cupWithHandle,
  doubleBottom,
  drawdown,
  headAndShouldersBottom,
  highTightFlag,
} from '@/lib/data/loader';
import { MonthlyChart, type MonthlySeriesDef } from './monthly-chart';
import { Badges } from './badges';
import { IndicatorExplanations } from './indicator-explanation';
import type { ValueKind } from './chart-frame';
import { indicators } from '@/lib/data/indicators';
import { economy, macro } from '@/lib/data/loader';
import type { DailyPoint } from '@/lib/data/daily-series';
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
  /**
   * 読者向け解説を出す指標 (#208)。省略すると `primaryIndicator` の 1 件だけになる。
   *
   * **総合とコアのように差そのものが意味を持つ図では両方を挙げる。** 片方しか説明しないと、
   * 読者は「なぜ 2 本あるのか」が分からないまま図を見ることになる。
   */
  explainIndicators?: readonly string[];
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
  /**
   * 日次グリッドの価格系列 (#137)。週次グリッドは金曜の値だけを拾うため、
   * 週内の動きがそもそも図に出ていなかった。
   */
  | (ChartBase<K> & {
      frequency: 'daily';
      kind?: ValueKind;
      signed?: boolean;
      baseline?: { value: number; label: string };
      series: SeriesDef[];
    })
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
      /**
       * 欠測を跨いで線を繋ぐか (#226)。**四半期の系列を月次グリッドに載せる場合だけ。**
       *
       * 3 か月に 1 点しか無いのは構造的で、取れなかったわけではない。
       */
      connectNulls?: boolean;
      /** 定義から決まる基準線。DI の 50 など (#160)。 */
      baseline?: { value: number; label: string };
      series: MonthlySeriesDef[];
    })
  /**
   * 最高値からの下落率 (#128)。系列は指標マスタではなくグループで決まるため、
   * `series` の代わりに `drawdownGroup` を持つ。
   */
  | (ChartBase<K> & { frequency: 'weekly'; drawdownGroup: string })
  /**
   * High Tight Flag の検出結果 (#231)。時系列チャートではなくリスト表示なので
   * `series` を持たない。
   */
  | (ChartBase<K> & { frequency: 'daily'; highTightFlag: true })
  /** カップウィズハンドルの検出結果 (#230)。High Tight Flag と同じくリスト表示。 */
  | (ChartBase<K> & { frequency: 'daily'; cupWithHandle: true })
  /** ダブルボトムの検出結果 (#256)。High Tight Flag と同じくリスト表示。 */
  | (ChartBase<K> & { frequency: 'daily'; doubleBottom: true })
  /** ヘッド・アンド・ショルダーズ・ボトム (逆三尊) の検出結果 (#258)。同じくリスト表示。 */
  | (ChartBase<K> & { frequency: 'daily'; headAndShouldersBottom: true });

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

/**
 * 解説を出す指標の一覧 (#208)。
 *
 * **月次は系列定義から辿る。** `MonthlySeriesDef.indicatorId` が必須なので、
 * 図に出ている指標をそのまま列挙できる。手書きの一覧と違って**ずれない** — 系列を足したのに
 * 解説の一覧を直し忘れる、という #109 の型の事故が起きない。
 *
 * 日次・週次の `SeriesDef` はビューのキーしか持たず指標 ID を辿れないため、
 * `explainIndicators` で明示するか、既定の主指標 1 件になる。
 */
function explainedIds<K extends string>(chart: QuestionChartDef<K>): readonly string[] {
  if (chart.explainIndicators !== undefined) return chart.explainIndicators;
  if (chart.frequency === 'monthly') {
    // 同じ指標を 2 本の系列で出す図があるため重複を落とす。
    return [...new Set(chart.series.map((definition) => definition.indicatorId))];
  }
  return [chart.primaryIndicator];
}

/** グループ内の順序で色を割り当てる。系列が 13 本を超えたら一周する。 */
function paletteFor(assets: ReadonlyArray<{ id: string }>): Record<string, string> {
  return Object.fromEntries(
    assets.map((asset, i) => [asset.id, DRAWDOWN_PALETTE[i % DRAWDOWN_PALETTE.length]]),
  );
}

/** 見出しへのアンカー。問いの ID をそのまま使う。 */
export function questionAnchor(id: string): string {
  return `q-${id}`;
}

export function QuestionSections<K extends string>({
  charts,
  questions,
  dailyPoints,
}: {
  charts: readonly QuestionChartDef<K>[];
  questions: Record<K, Question>;
  /**
   * 日次グリッドの系列 (#168)。**ページごとに違うビューを渡す。**
   * ここで 1 本に固定すると、使わない系列まで全ページに載る。
   */
  dailyPoints: readonly DailyPoint[];
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
              {'drawdownGroup' in chart ? (
                <DrawdownChart
                  title={chart.title}
                  subtitle={chart.subtitle}
                  assets={drawdown.assets.filter((asset) => asset.group === chart.drawdownGroup)}
                  colors={paletteFor(
                    drawdown.assets.filter((asset) => asset.group === chart.drawdownGroup),
                  )}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : 'highTightFlag' in chart ? (
                <HighTightFlagList
                  title={chart.title}
                  subtitle={chart.subtitle}
                  assets={highTightFlag.assets}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : 'cupWithHandle' in chart ? (
                <CupWithHandleList
                  title={chart.title}
                  subtitle={chart.subtitle}
                  assets={cupWithHandle.assets}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : 'doubleBottom' in chart ? (
                <DoubleBottomList
                  title={chart.title}
                  subtitle={chart.subtitle}
                  assets={doubleBottom.assets}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : 'headAndShouldersBottom' in chart ? (
                <HeadAndShouldersBottomList
                  title={chart.title}
                  subtitle={chart.subtitle}
                  assets={headAndShouldersBottom.assets}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : chart.frequency === 'daily' ? (
                <MacroChart
                  points={dailyPoints}
                  title={chart.title}
                  subtitle={chart.subtitle}
                  kind={chart.kind}
                  signed={chart.signed}
                  baseline={chart.baseline}
                  series={chart.series}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  changeLabel="前日比"
                  badges={<Badges frequency="daily" cyclePosition={cycleOf(chart)} />}
                />
              ) : chart.frequency === 'weekly' ? (
                <MacroChart
                  points={macro}
                  title={chart.title}
                  subtitle={chart.subtitle}
                  kind={chart.kind}
                  signed={chart.signed}
                  baseline={chart.baseline}
                  series={chart.series}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
                  changeLabel="前週比"
                  badges={<Badges frequency="weekly" cyclePosition={cycleOf(chart)} />}
                />
              ) : (
                <MonthlyChart
                  view={economy}
                  title={chart.title}
                  subtitle={chart.subtitle}
                  kind={chart.kind}
                  zeroLine={chart.zeroLine}
                  baseline={chart.baseline}
                  series={chart.series}
                  connectNulls={chart.connectNulls}
                  notes={chart.notes}
                  explanation={<IndicatorExplanations ids={explainedIds(chart)} />}
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
