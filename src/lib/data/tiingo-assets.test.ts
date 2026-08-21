import { describe, expect, it } from 'vitest';
import { DRAWDOWN_ASSETS } from './drawdown-assets';
import { TIINGO_SYMBOLS } from './tiingo-assets';

describe('TIINGO_SYMBOLS (#229)', () => {
  it('DRAWDOWN_ASSETS (#128) と同じ件数を対象にする', () => {
    // TIINGO_SYMBOLS は DRAWDOWN_ASSETS から導出しているため、対象が
    // ずれることはない (件数一致は「導出元を書き換えていないか」の確認)。
    expect(TIINGO_SYMBOLS).toHaveLength(DRAWDOWN_ASSETS.length);
  });

  it('SPY (先頭銘柄) を正しく解決する', () => {
    // 導出ロジック (指標マスタの finnhub symbol を引く) が実際に動くことの確認。
    expect(TIINGO_SYMBOLS).toContain('SPY');
  });

  it('重複が無い', () => {
    expect(new Set(TIINGO_SYMBOLS).size).toBe(TIINGO_SYMBOLS.length);
  });
});
