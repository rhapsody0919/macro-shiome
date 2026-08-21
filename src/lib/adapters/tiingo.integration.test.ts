/**
 * 実 API に対する検証 (#229)。
 *
 * **フィクスチャは実データの代わりにならない** (#4)。ネットワークと API キーが要るので
 * 既定ではスキップし、`RUN_INTEGRATION=1 TIINGO_API_KEY=... pnpm vitest` で実行する。
 */
import { describe, expect, it } from 'vitest';
import { TiingoClient } from './tiingo';

const key = process.env.TIINGO_API_KEY ?? '';
const run = process.env.RUN_INTEGRATION === '1' && key.length > 0;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe.skipIf(!run)('Tiingo (統合)', () => {
  const client = new TiingoClient({ apiKey: key });

  it('ETF の日足 OHLCV を取れる', async () => {
    const { bars, skipped } = await client.fetchRecentBars('SPY', daysAgo(10));
    expect(bars.length).toBeGreaterThan(0);
    expect(skipped).toEqual([]);
    const latest = bars.at(-1)!;
    // S&P 500 が 7,700 のとき SPY は 770 前後。桁違いを検出する。
    expect(latest.bar.close).toBeGreaterThan(100);
    expect(latest.bar.close).toBeLessThan(5000);
    expect(latest.bar.high).toBeGreaterThanOrEqual(latest.bar.low);
  }, 30_000);

  it('存在しない symbol は失敗にする', async () => {
    await expect(client.fetchRecentBars('NOTAREALTICKER123', daysAgo(10))).rejects.toThrow();
  }, 30_000);

  it('エラーに API キーを含めない', async () => {
    // トークンが載っていないことを確認する。公開リポの Actions ログは誰でも読める。
    //
    // **`toThrow(expect.not.stringContaining(...))` は使わない。** toThrow に渡した
    // matcher は catch した Error インスタンスそのものを受け取るが、
    // StringContaining は対象が文字列でないと常に false (= not で反転して常に true)
    // を返すため、実際にはメッセージの中身を一切検証しない (実機で確認済み)。
    // `.message` を明示的に検査する toSatisfy を使う。
    const bad = new TiingoClient({ apiKey: 'invalid-key-for-test' });
    await expect(bad.fetchRecentBars('SPY', daysAgo(10))).rejects.toSatisfy(
      (error: unknown) => error instanceof Error && !error.message.includes('token='),
    );
  }, 30_000);
});
