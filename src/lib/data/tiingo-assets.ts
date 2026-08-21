import { DRAWDOWN_ASSETS } from './drawdown-assets';
import { indicators } from './indicators';

/**
 * Tiingo から OHLCV を取る対象 ETF (#229、ADR-0008)。
 *
 * **下落率 (#128, `DRAWDOWN_ASSETS`) と同じ 36 銘柄を、指標マスタの finnhub symbol
 * から導出する。** 手打ちで複製すると、#128 の対象銘柄を変更したときに
 * 両方を直し忘れて対象がずれる (CLAUDE.md の DRY 原則)。指標マスタ自体は
 * 経由しない (OHLCV は指標マスタが前提とする 1 系列 = スカラー値と型が合わない、
 * ADR-0008) が、対象銘柄の一覧は指標マスタが真実の源のまま。
 */
export const TIINGO_SYMBOLS: readonly string[] = DRAWDOWN_ASSETS.map(({ id }) => {
  const indicator = indicators[id];
  if (indicator === undefined || indicator.source.adapter !== 'finnhub') {
    throw new Error(`${id}: 指標マスタに finnhub symbol が無い (tiingo-assets.ts)`);
  }
  return indicator.source.symbol;
});
