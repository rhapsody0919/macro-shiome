/**
 * 系列の蓄積状況の判定 (screens C-2)。
 *
 * データが線にならない理由には**性質の違う 3 つ**がある。混同させると読み手が誤解する。
 *
 * 1. **蓄積中**: 時間が経てば解消する。本モジュールが扱うのはこれだけ
 * 2. **取得経路が無い**: 恒久的な制約。`ValuationSeries.hasForwardEps` で表す
 * 3. **選択した期間に無いだけ**: 期間を広げれば見える。各チャートの summary が扱う
 *
 * 3 と混ざらないよう、**判定は必ず全期間の系列に対して行う**。期間フィルター後の
 * 点列で判定すると、期間を絞っただけで「蓄積中」と表示されてしまう。
 */

/**
 * 線として読める最低限の週数。
 *
 * 週次系列を前提にした値 (8 点 = 約 2 か月)。1〜2 点では折れ線が引けず、
 * 空のチャートが「壊れている」ように見える。
 */
export const MIN_WEEKS_FOR_LINE = 8;

export type SeriesState =
  /** 線を引ける。 */
  | { kind: 'ok'; count: number }
  /** まだ線にならない。週を追うごとに増える。 */
  | { kind: 'accumulating'; count: number; from: string | null };

/**
 * 値を持つ点だけを取り出す。
 *
 * 「欠測とは何か」の定義をここに集約する。判定と表示で別々に filter を書くと、
 * 片方だけ条件を変えたときに「線は出るのに最新値が無い」といった食い違いが生まれる。
 */
export function withValue<T>(points: readonly T[], pick: (point: T) => number | null): T[] {
  return points.filter((point) => pick(point) !== null);
}

/**
 * 系列が線として成立するかを判定する。
 *
 * **全期間の系列を渡すこと** (期間フィルター後の点列ではない)。
 */
export function seriesState<T extends { date: string }>(
  allPoints: readonly T[],
  pick: (point: T) => number | null,
): SeriesState {
  const values = withValue(allPoints, pick);
  if (values.length >= MIN_WEEKS_FOR_LINE) return { kind: 'ok', count: values.length };
  return { kind: 'accumulating', count: values.length, from: values[0]?.date ?? null };
}

/**
 * 蓄積中であることの説明文。
 *
 * 図の代わりに出す場合も、チャート下の注記に混ぜる場合も同じ文面を使う。
 * 2 か所で書き分けると閾値を変えたときに片方だけ古くなる。
 */
export function describeAccumulation(
  state: Extract<SeriesState, { kind: 'accumulating' }>,
  label: string,
  formatDate: (date: string) => string,
): string {
  const need = `線として読むには ${MIN_WEEKS_FOR_LINE} 週分が要る。`;
  if (state.count === 0 || state.from === null) {
    return `${label} はまだ 1 件も取得できていない。${need}`;
  }
  return `${label} は蓄積中 (${formatDate(state.from)} 以降、${state.count} 週分)。${need}`;
}
