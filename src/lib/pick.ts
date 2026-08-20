/**
 * 系列から「最新値と前回比」を取り出す (#76)。
 *
 * **欠測を跨いだ場合は何回前と比べたかを返す**。前週が欠測なのに「前週比」と表示すると、
 * 実際は 2 週前との差なのに 1 週分の変化と誤解される (plan U-S3)。
 */

export interface Latest {
  value: number | null;
  /** 前回との差。比較相手が無ければ null。 */
  delta: number | null;
  /** 何点前と比べたか。1 なら直前、2 以上は欠測を跨いでいる。 */
  stepsBack: number;
  /** 値を持つ最後の点の識別子 (日付または月)。 */
  at: string | null;
}

/**
 * 値を持つ最後の 2 点から最新値と差分を求める。
 *
 * 欠測は飛ばすが、**元の系列上で何点離れているか**を数えて返す。
 */
export function pickLatest<T>(
  points: readonly T[],
  valueOf: (point: T) => number | null,
  keyOf: (point: T) => string,
): Latest {
  const indexed = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => valueOf(point) !== null);

  const last = indexed.at(-1);
  if (last === undefined) {
    return { value: null, delta: null, stepsBack: 1, at: null };
  }

  const previous = indexed.at(-2);
  const value = valueOf(last.point) as number;
  if (previous === undefined) {
    return { value, delta: null, stepsBack: 1, at: keyOf(last.point) };
  }

  return {
    value,
    delta: value - (valueOf(previous.point) as number),
    stepsBack: Math.max(1, last.index - previous.index),
    at: keyOf(last.point),
  };
}

/**
 * 「前週比」「3週前比」のようなラベルを作る。
 *
 * 月は「2月前比」だと読みにくいので「2か月前比」にする。
 */
export function stepLabel(stepsBack: number, unit: '日' | '週' | '月'): string {
  if (stepsBack === 1) return `前${unit}比`;
  return unit === '月' ? `${stepsBack}か月前比` : `${stepsBack}${unit}前比`;
}
