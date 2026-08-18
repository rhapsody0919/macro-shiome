import { describe, expect, it } from 'vitest';
import type { Indicator } from '../data/types';
import {
  assertNoIssues,
  checkCloseConsistency,
  checkGapStreak,
  checkNotEmpty,
  checkRange,
  checkWeekOverWeek,
} from './checks';

function indicator(overrides: Partial<Indicator> = {}): Indicator {
  return {
    name: 'テスト',
    source: { adapter: 'fred', seriesId: 'TEST' },
    frequency: 'daily',
    unit: 'index',
    attribution: 'Test',
    copyright: 'none',
    group: 'equity',
    ...overrides,
  };
}

describe('checkRange', () => {
  it('妥当な PER を通す', () => {
    const pe = indicator({ unit: 'ratio', group: 'valuation' });
    expect(checkRange('pe', pe, '2026-08-07', 20.0)).toEqual([]);
    expect(checkRange('pe', pe, '2026-08-07', 28.2)).toEqual([]);
  });

  it('桁違いの PER を弾く', () => {
    // 200.0 のような値は取り違えを疑う水準。
    const pe = indicator({ unit: 'ratio', group: 'valuation' });
    expect(checkRange('pe', pe, '2026-08-07', 200)).toHaveLength(1);
    expect(checkRange('pe', pe, '2026-08-07', 1)).toHaveLength(1);
  });

  it('負の指数を弾く', () => {
    expect(checkRange('sp500', indicator(), '2026-08-07', -1)).toHaveLength(1);
  });

  it('金利の範囲を検証する', () => {
    const rate = indicator({ unit: 'percent', group: 'rates' });
    expect(checkRange('dgs10', rate, '2026-08-07', 4.69)).toEqual([]);
    // マイナス金利は許容するが、桁違いは弾く。
    expect(checkRange('dgs10', rate, '2026-08-07', -0.5)).toEqual([]);
    expect(checkRange('dgs10', rate, '2026-08-07', 46.9)).toHaveLength(1);
  });

  it('増益率は金利より広い範囲を許す', () => {
    // 実測で 50.4% があり、過去には 90% 超の四半期もある。減益局面は負になる。
    const growth = indicator({ unit: 'percent', group: 'valuation' });
    expect(checkRange('growth', growth, '2026-08-07', 50.4)).toEqual([]);
    expect(checkRange('growth', growth, '2026-08-07', 91.6)).toEqual([]);
    expect(checkRange('growth', growth, '2026-08-07', -20)).toEqual([]);
  });

  it('NaN や Infinity を弾く', () => {
    // 0 除算の結果が紛れ込むのを防ぐ。
    expect(checkRange('x', indicator(), '2026-08-07', Number.NaN)).toHaveLength(1);
    expect(checkRange('x', indicator(), '2026-08-07', Number.POSITIVE_INFINITY)).toHaveLength(1);
  });
});

describe('checkWeekOverWeek', () => {
  const index = indicator({ unit: 'index', group: 'equity' });

  it('通常の変動を通す', () => {
    expect(checkWeekOverWeek('sp500', index, '2026-08-14', 7785.76, 7709.96)).toEqual([]);
  });

  it('急変を弾く', () => {
    // 桁違いや別系列の混入は急変として現れる。
    expect(checkWeekOverWeek('sp500', index, '2026-08-14', 15000, 7709.96)).toHaveLength(1);
  });

  it('増益率には適用しない', () => {
    // 実測で 23.1% → 47.4% → 50.4% と動く。相対変化で見ると必ず閾値を超える。
    const growth = indicator({ unit: 'percent', group: 'valuation' });
    expect(checkWeekOverWeek('growth', growth, '2026-08-07', 50.4, 23.1)).toEqual([]);
  });

  it('金利には適用する', () => {
    const rate = indicator({ unit: 'percent', group: 'rates' });
    expect(checkWeekOverWeek('dgs10', rate, '2026-08-14', 4.69, 4.63)).toEqual([]);
    expect(checkWeekOverWeek('dgs10', rate, '2026-08-14', 9.0, 4.63)).toHaveLength(1);
  });

  it('前週の値が無ければ検証しない', () => {
    expect(checkWeekOverWeek('sp500', index, '2026-08-14', 7785.76, null)).toEqual([]);
    expect(checkWeekOverWeek('sp500', index, '2026-08-14', 7785.76, 0)).toEqual([]);
  });
});

describe('checkCloseConsistency', () => {
  it('同水準なら通す', () => {
    // FactSet 2026-08-07 号の終値と、その日の FRED 指数。
    expect(checkCloseConsistency(7709.96, 7709.96, '2026-08-07')).toEqual([]);
    expect(checkCloseConsistency(7709.96, 7740.0, '2026-08-07')).toEqual([]);
  });

  it('大きく乖離していれば弾く', () => {
    // EPS は FactSet の終値を PER で割って導出するため、乖離は時点ずれか取得ミスを示す。
    const issues = checkCloseConsistency(7709.96, 6500.0, '2026-08-07');
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe('close-consistency');
  });

  it('片方が欠測なら検証しない', () => {
    expect(checkCloseConsistency(null, 7709.96, '2026-08-07')).toEqual([]);
    expect(checkCloseConsistency(7709.96, undefined, '2026-08-07')).toEqual([]);
  });
});

describe('checkGapStreak', () => {
  it('2 週までの欠測は許容する', () => {
    // 2026 年の夏季休刊は 8/14・8/21 の 2 週。
    expect(checkGapStreak('sp500-forward-pe', [false, false, true, true])).toEqual([]);
  });

  it('3 週連続の欠測を弾く', () => {
    // 休刊の実績を超えるため、URL 規則の変更や取得経路の破損を疑う。
    const issues = checkGapStreak('sp500-forward-pe', [false, false, false, true]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('3 週連続');
  });

  it('直近にデータがあれば連続とみなさない', () => {
    expect(checkGapStreak('x', [true, false, false, false])).toEqual([]);
  });
});

describe('checkNotEmpty', () => {
  it('空の抽出結果を弾く', () => {
    expect(checkNotEmpty('sp500-forward-pe', {})).toHaveLength(1);
  });

  it('値があれば通す', () => {
    expect(checkNotEmpty('sp500-forward-pe', { forwardPe: 20.0 })).toEqual([]);
  });
});

describe('assertNoIssues', () => {
  it('問題が無ければ通す', () => {
    expect(() => assertNoIssues([])).not.toThrow();
  });

  it('1 件でも問題があれば失敗させる', () => {
    // 「緑だが歯抜け」を作らないため、部分的な失敗を許さない。
    expect(() =>
      assertNoIssues([
        { indicatorId: 'sp500', date: '2026-08-14', rule: 'range', message: '範囲外' },
      ]),
    ).toThrow(/1 件/);
  });

  it('全ての問題を列挙する', () => {
    // 1 件直して再実行、を繰り返さずに済むよう、まとめて示す。
    try {
      assertNoIssues([
        { indicatorId: 'a', rule: 'range', message: 'A の問題' },
        { indicatorId: 'b', date: '2026-08-14', rule: 'week-over-week', message: 'B の問題' },
      ]);
      expect.unreachable('例外が投げられるはず');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('A の問題');
      expect(message).toContain('B の問題');
      expect(message).toContain('2026-08-14');
    }
  });
});

describe('拡散指数の範囲 (#94)', () => {
  const survey: Indicator = {
    name: 'NY連銀景気指数',
    source: { adapter: 'fred', seriesId: 'GACDISA066MSFRBNY' },
    frequency: 'monthly',
    unit: 'diffusion',
    attribution: 'Federal Reserve Bank of New York via FRED',
    copyright: 'none',
    group: 'macro',
  };

  it('負の値を通す', () => {
    // 拡散指数は 0 を挟んで振れる。index の範囲 (min 0) では弾かれてしまう。
    expect(checkRange('ny-fed-survey', survey, '2026-08-01', -12.5)).toEqual([]);
  });

  it('±100 を超える値は弾く', () => {
    // 定義上 −100〜+100 に収まるので、超えたら取り違えを疑う。
    expect(checkRange('ny-fed-survey', survey, '2026-08-01', 150)).not.toEqual([]);
    expect(checkRange('ny-fed-survey', survey, '2026-08-01', -150)).not.toEqual([]);
  });
})
