/**
 * 導出値の計算 (spec D-11〜D-25)。
 *
 * 画面が使う値のほとんどは実データではなく導出値なので、計算はここに集約してテスト可能にする。
 * クライアントで再計算せず、ビルド時にこの関数群で埋める (plan 3-4)。
 *
 * 方針:
 * - **欠測 (null) は null のまま伝播させる**。欠測は正常な状態であり、0 で埋めない
 * - **異常な入力 (0 以下の PER など) はエラーにする**。Infinity を silent に返すと
 *   もっともらしい値が蓄積してしまう
 * - **% は % のまま扱う** (4.68 であって 0.0468 ではない)。小数表記との混在は誤読の元
 */

/** 欠測を許容する入力。 */
export type Maybe = number | null | undefined;

function isMissing(value: Maybe): value is null | undefined {
  return value === null || value === undefined;
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}: 正の有限数が必要 (実際: ${value})`);
  }
  return value;
}

/**
 * PER から EPS を逆算する (spec D-11 / D-12)。
 * EPS の絶対値を取得できる無料経路が無いため、これが唯一の入手方法。
 *
 * 除数には **PER と同一時点の終値**を使うこと (FactSet PDF 内の closePrice)。
 * FRED の指数を使うと時点がずれる。
 */
export function epsFromPe(index: Maybe, pe: Maybe): number | null {
  if (isMissing(index) || isMissing(pe)) return null;
  requirePositive(pe, 'PER');
  return index / pe;
}

/** 株式益回り (%) = 1 ÷ PER × 100 (spec D-13)。 */
export function earningsYield(pe: Maybe): number | null {
  if (isMissing(pe)) return null;
  requirePositive(pe, 'PER');
  return (1 / pe) * 100;
}

/**
 * 実質金利 (%) = 名目 10 年債利回り − 期待インフレ率 (spec D-22)。
 * 名目金利をそのまま使うとイールドスプレッドが別物になる (spec F-4 の定義修正)。
 */
export function realRate(nominalRate: Maybe, breakevenInflation: Maybe): number | null {
  if (isMissing(nominalRate) || isMissing(breakevenInflation)) return null;
  return nominalRate - breakevenInflation;
}

/**
 * イールドスプレッド (%) = 株式益回り − 実質金利 (spec D-14)。
 * 正なら株式の相対的な魅力が高い。
 */
export function yieldSpread(equityYield: Maybe, real: Maybe): number | null {
  if (isMissing(equityYield) || isMissing(real)) return null;
  return equityYield - real;
}

/**
 * 理論値 = 実績 EPS ÷ 基準益回り (spec D-24)。
 *
 * 基準益回りは外部から取得できる値ではなく、成長率見通しに基づく裁量パラメータ。
 * この値の設定次第で理論値が変わるため、画面には必ず設定値を併記する (spec F-13)。
 */
export function fairValue(trailingEps: Maybe, targetYieldPercent: Maybe): number | null {
  if (isMissing(trailingEps) || isMissing(targetYieldPercent)) return null;
  requirePositive(targetYieldPercent, '基準益回り');
  return trailingEps / (targetYieldPercent / 100);
}

/**
 * 割高率 (%) = (1 − 理論値 ÷ 指数値) × 100 (spec D-25)。
 * 正なら割高、負なら割安。
 */
export function overvaluation(fair: Maybe, index: Maybe): number | null {
  if (isMissing(fair) || isMissing(index)) return null;
  requirePositive(index, '指数値');
  return (1 - fair / index) * 100;
}

/** 前週比。欠測なら null。 */
export interface Change {
  absolute: number;
  percent: number;
}

export function change(current: Maybe, previous: Maybe): Change | null {
  if (isMissing(current) || isMissing(previous)) return null;
  if (previous === 0) {
    throw new Error('前週比: 前週の値が 0 のため変化率を計算できない');
  }
  return {
    absolute: current - previous,
    percent: ((current - previous) / Math.abs(previous)) * 100,
  };
}

/**
 * 各時点が「その時点までの最高値」を更新したかを返す (spec F-2)。
 *
 * 参考にしている分析では毎週手作業で「(過去最高値)」と注記されている部分の自動化。
 * 欠測はスキップし、最高値の判定には含めない。
 */
export function markRecordHighs(series: readonly Maybe[]): boolean[] {
  let max = Number.NEGATIVE_INFINITY;
  return series.map((value) => {
    if (isMissing(value)) return false;
    if (value > max) {
      max = value;
      return true;
    }
    return false;
  });
}

/**
 * 系列の分布 (spec F-4 の読み方支援)。
 *
 * **固定の閾値を「危険水準」として置かない**。「スプレッドが 1% を切ったら危険」のような
 * 線には定説が無く、恣意的な基準を画面に出すことになる (VIX に補助線を引かなかったのと
 * 同じ判断。plan U-S1)。代わりに実データの分布を出し、現在値がどこにあるかを示す。
 */
export interface Distribution {
  mean: number;
  /** 標本標準偏差 (n − 1)。Excel の STDEV と同じ定義。 */
  sd: number;
  n: number;
}

/**
 * 平均と標準偏差を求める。
 *
 * 標本数が少ないと平均も標準偏差も偶然で大きく振れるため、
 * `minSamples` 未満では値を出さない (相関と同じ基準に揃える)。
 */
export function distribution(
  values: readonly Maybe[],
  minSamples = 10,
): Distribution | null {
  const present = values.filter((value): value is number => !isMissing(value));
  const n = present.length;
  if (n < minSamples) return null;

  const mean = present.reduce((sum, value) => sum + value, 0) / n;
  const variance = present.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);

  return { mean, sd: Math.sqrt(variance), n };
}

/**
 * 標本の中で `target` が下から何 % の位置にあるかを返す (0〜100)。
 *
 * 同値は半分ずつ数える中間順位法。「過去 5 年で下位 12% の水準」のように、
 * 恣意的な閾値を置かずに現在の位置を示すために使う。
 */
export function percentileRank(values: readonly Maybe[], target: Maybe): number | null {
  if (isMissing(target)) return null;

  const present = values.filter((value): value is number => !isMissing(value));
  if (present.length === 0) return null;

  const below = present.filter((value) => value < target).length;
  const equal = present.filter((value) => value === target).length;
  return ((below + equal / 2) / present.length) * 100;
}

/** 相関の計算結果。標本数が少ない場合は値を出さない。 */
export type Correlation =
  | { kind: 'ok'; r: number; n: number }
  | { kind: 'insufficient'; n: number };

/**
 * ピアソン相関係数 (spec F-5)。
 *
 * **両方に値がある組だけを使う** (ペアワイズ削除)。欠測を 0 で埋めると相関が大きく歪む。
 * 標本数が少ないと相関係数は偶然で大きく振れるため、n < minSamples では値を出さない。
 */
export function correlation(
  xs: readonly Maybe[],
  ys: readonly Maybe[],
  minSamples = 10,
): Correlation {
  if (xs.length !== ys.length) {
    throw new Error(`相関: 系列の長さが違う (${xs.length} と ${ys.length})`);
  }

  const pairs: Array<[number, number]> = [];
  for (const [i, x] of xs.entries()) {
    const y = ys[i];
    if (isMissing(x) || isMissing(y)) continue;
    pairs.push([x, y]);
  }

  const n = pairs.length;
  if (n < minSamples) return { kind: 'insufficient', n };

  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  // どちらかが定数だと相関は定義できない。0 除算で NaN を返さず明示的に扱う。
  if (varianceX === 0 || varianceY === 0) {
    return { kind: 'insufficient', n };
  }

  return { kind: 'ok', r: covariance / Math.sqrt(varianceX * varianceY), n };
}
