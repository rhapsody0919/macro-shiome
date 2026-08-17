import { describe, expect, it } from 'vitest';
import {
  change,
  correlation,
  distribution,
  earningsYield,
  epsFromPe,
  fairValue,
  markRecordHighs,
  overvaluation,
  percentileRank,
  realRate,
  yearOverYear,
  yieldSpread,
} from './derived';

/**
 * 実測値による検算。
 * 2026-08-07 号 (FactSet) と 2026-08-15 付の市場データを使う。
 */
describe('実測値での検算', () => {
  it('Forward EPS = 終値 ÷ Forward PER', () => {
    // FactSet 2026-08-07 号: 終値 7709.96 / forward P/E 20.0
    expect(epsFromPe(7709.96, 20.0)).toBeCloseTo(385.5, 1);
  });

  it('Trailing EPS = 終値 ÷ Trailing PER', () => {
    // 同号: trailing P/E 28.2。CY2025 の bottom-up EPS 274.74 に対し誤差 0.5% に収まる。
    expect(epsFromPe(7709.96, 28.2)).toBeCloseTo(273.4, 1);
  });

  it('株式益回り = 1 ÷ PER', () => {
    // 2026-08-15 時点: forward PER 21.39 → 益回り 4.68%
    expect(earningsYield(21.39)).toBeCloseTo(4.68, 2);
  });

  it('実質金利 = 名目 10 年債 − 期待インフレ率', () => {
    // 2026-08-15 時点: 10年債 4.69% − 期待インフレ 2.24% = 2.45%
    expect(realRate(4.69, 2.24)).toBeCloseTo(2.45, 2);
  });

  it('イールドスプレッド = 益回り − 実質金利', () => {
    // 2026-08-15 時点: 4.68% − 2.45% = 2.23%
    expect(yieldSpread(4.68, 2.45)).toBeCloseTo(2.23, 2);
  });

  it('名目金利で計算すると全く別の値になる', () => {
    // spec F-4 の定義修正の根拠。実質 2.23% に対し名目だと 0.02% 未満になる。
    const withNominal = yieldSpread(4.68, 4.69);
    expect(withNominal).toBeCloseTo(-0.01, 2);
  });

  it('理論値 = 実績 EPS ÷ 基準益回り', () => {
    // 実績 EPS 298.14 ÷ 4.0% = 7453.5
    expect(fairValue(298.14, 4.0)).toBeCloseTo(7453.5, 1);
  });

  it('割高率 = 1 − 理論値 ÷ 指数値', () => {
    // 指数 7748.5 に対し理論値 7453.5 → 3.81% の割高
    expect(overvaluation(7453.5, 7748.5)).toBeCloseTo(3.81, 2);
    // 指数が 7785.76 に上がると 4.27% の割高 (理論値は据え置き)
    expect(overvaluation(7453.5, 7785.76)).toBeCloseTo(4.27, 2);
  });

  it('基準益回りを調整すると as-reported 基準でも同じ理論値になる', () => {
    // spec F-13: 本アプリの EPS は約 9% 低いため、基準益回り側で系統差を吸収する。
    expect(fairValue(273.4, 3.67)).toBeCloseTo(7449.6, 0);
  });
});

describe('欠測の扱い', () => {
  it('入力が欠測なら結果も欠測', () => {
    // 欠測は正常な状態。0 で埋めると誤った値が蓄積する。
    expect(epsFromPe(null, 20)).toBeNull();
    expect(epsFromPe(7709.96, null)).toBeNull();
    expect(earningsYield(undefined)).toBeNull();
    expect(realRate(4.69, null)).toBeNull();
    expect(yieldSpread(null, 2.45)).toBeNull();
    expect(fairValue(298.14, null)).toBeNull();
    expect(overvaluation(null, 7748.5)).toBeNull();
    expect(change(100, null)).toBeNull();
  });
});

describe('異常値の扱い', () => {
  it('PER が 0 以下ならエラー', () => {
    // Infinity を silent に返すと、もっともらしい EPS が蓄積してしまう。
    expect(() => epsFromPe(7709.96, 0)).toThrow(/PER/);
    expect(() => epsFromPe(7709.96, -1)).toThrow(/PER/);
    expect(() => earningsYield(0)).toThrow(/PER/);
  });

  it('基準益回りが 0 以下ならエラー', () => {
    expect(() => fairValue(298.14, 0)).toThrow(/基準益回り/);
  });

  it('指数値が 0 以下ならエラー', () => {
    expect(() => overvaluation(7453.5, 0)).toThrow(/指数値/);
  });

  it('前週の値が 0 なら変化率を計算せずエラー', () => {
    expect(() => change(100, 0)).toThrow(/0/);
  });
});

describe('change', () => {
  it('絶対値と変化率を返す', () => {
    const result = change(298.14, 297.33);
    expect(result?.absolute).toBeCloseTo(0.81, 2);
    expect(result?.percent).toBeCloseTo(0.272, 2);
  });

  it('負の値からの変化でも符号が正しい', () => {
    // イールドスプレッドは負になりうる。−1.0 → −0.5 は改善 (正の変化)。
    const result = change(-0.5, -1.0);
    expect(result?.absolute).toBeCloseTo(0.5, 2);
    expect(result?.percent).toBeCloseTo(50, 2);
  });
});

describe('markRecordHighs', () => {
  it('最高値を更新した時点を示す', () => {
    // 参考にしている分析の「(過去最高値)」注記の自動化。
    const series = [259.72, 256.87, 261.04, 262.32, 262.32];
    expect(markRecordHighs(series)).toEqual([true, false, true, true, false]);
  });

  it('欠測は更新扱いにしない', () => {
    expect(markRecordHighs([100, null, 120, undefined])).toEqual([true, false, true, false]);
  });

  it('同値は更新扱いにしない', () => {
    expect(markRecordHighs([100, 100])).toEqual([true, false]);
  });

  it('空配列を扱える', () => {
    expect(markRecordHighs([])).toEqual([]);
  });
});

describe('correlation', () => {
  it('完全な正の相関を 1 と判定する', () => {
    const xs = Array.from({ length: 12 }, (_, i) => i);
    const ys = xs.map((x) => x * 2 + 1);
    const result = correlation(xs, ys);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.r).toBeCloseTo(1, 10);
      expect(result.n).toBe(12);
    }
  });

  it('完全な負の相関を -1 と判定する', () => {
    const xs = Array.from({ length: 12 }, (_, i) => i);
    const ys = xs.map((x) => -x);
    const result = correlation(xs, ys);
    if (result.kind === 'ok') expect(result.r).toBeCloseTo(-1, 10);
  });

  it('欠測ペアを除外する', () => {
    // 0 埋めすると相関が大きく歪むため、片方でも欠ければその組を捨てる。
    const xs = [1, 2, null, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ys = [2, 4, 6, null, 10, 12, 14, 16, 18, 20, 22, 24];
    const result = correlation(xs, ys);
    expect(result.n).toBe(10);
    if (result.kind === 'ok') expect(result.r).toBeCloseTo(1, 10);
  });

  it('標本数が足りなければ値を出さない', () => {
    // 少ない標本では相関係数が偶然で大きく振れるため、数値を見せない。
    const result = correlation([1, 2, 3], [2, 4, 6]);
    expect(result).toEqual({ kind: 'insufficient', n: 3 });
  });

  it('片方が定数なら値を出さない', () => {
    // 分散 0 で 0 除算になる。NaN を返さず明示的に扱う。
    const xs = Array.from({ length: 12 }, () => 5);
    const ys = Array.from({ length: 12 }, (_, i) => i);
    expect(correlation(xs, ys).kind).toBe('insufficient');
  });

  it('系列の長さが違えばエラー', () => {
    expect(() => correlation([1, 2], [1])).toThrow(/長さ/);
  });
});

describe('distribution', () => {
  it('平均と標準偏差を返す', () => {
    // 標本標準偏差 (n − 1)。1..10 の分散 = 55/6 ≒ 9.1667
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = distribution(values);
    expect(result?.mean).toBe(5.5);
    expect(result?.sd).toBeCloseTo(3.0277, 3);
    expect(result?.n).toBe(10);
  });

  it('欠測は除いて数える', () => {
    const values = [1, null, 2, undefined, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(distribution(values)?.n).toBe(10);
  });

  it('標本が少なければ値を出さない', () => {
    // 少数の標本では平均も標準偏差も偶然で大きく振れる。相関と同じ基準に揃える。
    expect(distribution([1, 2, 3])).toBeNull();
    expect(distribution(Array.from({ length: 9 }, () => 1))).toBeNull();
    expect(distribution(Array.from({ length: 10 }, () => 1))).not.toBeNull();
  });

  it('全部同じ値なら標準偏差 0', () => {
    const result = distribution(Array.from({ length: 10 }, () => 2.5));
    expect(result?.sd).toBe(0);
    expect(result?.mean).toBe(2.5);
  });
});

describe('percentileRank', () => {
  it('最小値は下位 0% 付近、最大値は 100% 付近', () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentileRank(values, 1)).toBe(10); // (0 + 1/2) / 5
    expect(percentileRank(values, 5)).toBe(90); // (4 + 1/2) / 5
  });

  it('中央値は 50%', () => {
    expect(percentileRank([1, 2, 3, 4, 5], 3)).toBe(50);
  });

  it('同値は半分ずつ数える (中間順位法)', () => {
    // 2 が 2 つ。下に 1 つ、同値 2 つ → (1 + 1) / 4 = 50%
    expect(percentileRank([1, 2, 2, 3], 2)).toBe(50);
  });

  it('標本に無い値でも位置を返す', () => {
    expect(percentileRank([1, 2, 3, 4], 2.5)).toBe(50);
  });

  it('欠測は除く', () => {
    expect(percentileRank([1, null, 2, undefined, 3], 2)).toBe(50);
  });

  it('対象が欠測なら null', () => {
    expect(percentileRank([1, 2, 3], null)).toBeNull();
  });

  it('標本が空なら null', () => {
    expect(percentileRank([null, undefined], 1)).toBeNull();
  });
});

describe('yearOverYear', () => {
  it('前年同月比 (%) を返す', () => {
    // 実測: 輸入物価 2026-06 = 150.8、2025-06 = 140.8 → +7.1%
    expect(yearOverYear(150.8, 140.8)).toBeCloseTo(7.1, 1);
  });

  it('低下は負になる', () => {
    expect(yearOverYear(95, 100)).toBeCloseTo(-5, 6);
  });

  it('欠測は null', () => {
    expect(yearOverYear(null, 100)).toBeNull();
    expect(yearOverYear(100, null)).toBeNull();
  });

  it('前年が 0 ならエラー', () => {
    // 静かに Infinity を返すと、もっともらしい値が蓄積してしまう。
    expect(() => yearOverYear(100, 0)).toThrow(/0/);
  });
});
