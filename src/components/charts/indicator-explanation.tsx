import { indicators } from '@/lib/data/indicators';
import type { Indicator } from '@/lib/data/types';

/**
 * 指標の系列 ID を出所の表記から組み立てる (#208)。
 *
 * **手書きさせない。** #198 で `BUSLOANS` の単位を百万ドルと書き誤った (実際は十億ドル) のは、
 * 説明文に単位を埋め込んでいたため。出所・系列 ID・単位はすべて指標マスタ 1 か所から出す。
 */
export function sourceIdOf(indicator: Indicator): string | null {
  const source = indicator.source;
  switch (source.adapter) {
    case 'fred':
      return source.seriesId;
    case 'estat':
      return source.indicatorCode;
    case 'estat-api':
      return source.statsDataId;
    case 'boj':
      return source.code;
    case 'finnhub':
    case 'stockanalysis':
      return source.symbol;
    // FactSet の PDF と財務省の入札は系列 ID を持たない (項目名で抽出している)。
    // シラーPERは単一ファイルの唯一の系列で、系列 ID という概念自体が無い (#291)。
    case 'factset-pdf':
    case 'treasury':
    case 'shiller':
      return null;
  }
}

const FREQUENCY_LABELS = {
  daily: '日次',
  weekly: '週次',
  monthly: '月次',
  quarterly: '四半期',
} as const;

/**
 * 指標の読者向け解説 (#208)。**解説を持つ指標が 1 つも無ければ何も描かない。**
 *
 * 空の折りたたみを出すと「開いても何も無い」ことを毎回試させることになる。
 *
 * 常時展開しない理由は #75。チャートは 70 枚あり、全部に解説を開いたまま並べると
 * スクロール量が倍になる。モバイルのヘッダーを 370px → 159px に削った意味が消える。
 */
export function IndicatorExplanations({ ids }: { ids: readonly string[] }) {
  const entries = ids
    .map((id) => {
      const indicator = indicators[id];
      if (indicator === undefined) {
        // 指標マスタから消えた ID を画面が指し続けても気付けないため落とす (#89 と同じ扱い)。
        throw new Error(`指標の解説: 指標マスタに無い ID を参照している (${id})`);
      }
      return { id, indicator };
    })
    .filter((entry) => entry.indicator.explanation !== undefined);

  if (entries.length === 0) return null;

  return (
    <details className="rounded border border-slate-200 text-[11px] dark:border-slate-800">
      <summary className="cursor-pointer px-3 py-2 text-slate-600 dark:text-slate-300">
        この指標について
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        {entries.map(({ id, indicator }) => (
          <Entry key={id} indicator={indicator} />
        ))}
      </div>
    </details>
  );
}

function Entry({ indicator }: { indicator: Indicator }) {
  // filter 済みだが、型を絞るために再確認する。
  const explanation = indicator.explanation;
  if (explanation === undefined) return null;

  const sourceId = sourceIdOf(indicator);

  return (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{indicator.name}</p>
      {/*
        3つの文が同じ見た目で並ぶと、どれが定義でどれが読み方の説明か区別できず
        「つらつらとした文章」に見える。短いラベルを付けて視覚的に構造化する。
      */}
      <p className="text-slate-600 dark:text-slate-300">
        <strong className="text-slate-700 dark:text-slate-200">定義: </strong>
        {explanation.what}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        <strong className="text-slate-700 dark:text-slate-200">読み方: </strong>
        {explanation.howToRead}
      </p>
      {explanation.seeWith !== undefined && (
        <p className="text-slate-600 dark:text-slate-300">
          <strong className="text-slate-700 dark:text-slate-200">合わせて見る: </strong>
          {explanation.seeWith}
        </p>
      )}
      {/*
        単位・頻度・出所は指標マスタから組み立てる。解説の本文には書かせない。

        **「提供元の単位」と書く。** 月次チャートの多くは前年同月比 (%) を表示しており、
        提供元の系列は指数や金額。ここで「単位」とだけ書くと、画面の縦軸の単位と誤読される。
      */}
      <p className="text-slate-500">
        {indicator.unitLabel !== undefined && <>提供元の単位: {indicator.unitLabel} / </>}
        {FREQUENCY_LABELS[indicator.frequency]} / {indicator.attribution}
        {sourceId !== null && <> ({sourceId})</>}
      </p>
    </div>
  );
}
