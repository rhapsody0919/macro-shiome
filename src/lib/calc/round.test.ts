import { describe, expect, it } from 'vitest';
import { roundViewNumbers } from './round';

describe('roundViewNumbers', () => {
  it('既定は 2 桁', () => {
    expect(roundViewNumbers({ drawdown: 1.1338509795855467 })).toEqual({ drawdown: 1.13 });
  });

  // 2 桁だと 1.16 になり、線が階段状になって動きが消える。
  it('為替は 4 桁で残す', () => {
    expect(roundViewNumbers({ usdEur: 1.15812345, cnyUsd: 6.74119 })).toEqual({
      usdEur: 1.1581,
      cnyUsd: 6.7412,
    });
  });

  it('入れ子でも桁の指定が効く', () => {
    expect(roundViewNumbers([{ points: [{ usdEur: 1.15812345, vix: 14.23456 }] }])).toEqual([
      { points: [{ usdEur: 1.1581, vix: 14.23 }] },
    ]);
  });

  it('欠測と文字列は触らない', () => {
    expect(roundViewNumbers({ date: '2026-08-20', vix: null })).toEqual({
      date: '2026-08-20',
      vix: null,
    });
  });

  // 非有限数は丸めると NaN のままなので、そのまま通す。検知は verify の役目 (#102)。
  it('非有限数はそのまま返す', () => {
    expect(roundViewNumbers({ x: Number.NaN }).x).toBeNaN();
  });
});

/**
 * 丸めの桁を変えたら落ちること (障害注入)。
 *
 * 「動いている」だけでは、桁を静かに変えても気付けない (#102 と同じ形)。
 */
describe('桁を変えたら落ちること', () => {
  it('既定を 1 桁にすると値が変わる', () => {
    expect(roundViewNumbers({ vix: 15.84 }, 1)).toEqual({ vix: 15.8 });
  });

  it('為替のキーは既定の桁指定を上書きする', () => {
    // 第 2 引数で 1 桁を渡しても、為替は 4 桁のまま。
    expect(roundViewNumbers({ usdEur: 1.15812345 }, 1)).toEqual({ usdEur: 1.1581 });
  });
});
