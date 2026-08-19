/**
 * 実 API に対する検証 (#128)。
 *
 * **フィクスチャは実データの代わりにならない** (#4)。ネットワークと API キーが要るので
 * 既定ではスキップし、`RUN_INTEGRATION=1 FINNHUB_API_KEY=... pnpm vitest` で実行する。
 */
import { describe, expect, it } from 'vitest';
import { FinnhubClient } from './finnhub';

const key = process.env.FINNHUB_API_KEY ?? '';
const run = process.env.RUN_INTEGRATION === '1' && key.length > 0;

describe.skipIf(!run)('Finnhub (統合)', () => {
  const client = new FinnhubClient({ apiKey: key });

  it('ETF の現在値を取れる', async () => {
    const spy = await client.fetchPrice('SPY');
    // S&P 500 が 7,700 のとき SPY は 770 前後。桁違いを検出する。
    expect(spy).toBeGreaterThan(100);
    expect(spy).toBeLessThan(5000);
  }, 30_000);

  it('存在しない symbol は失敗にする', async () => {
    // Finnhub は 200 と {"c":0} を返す。0 を保存すると「株価ゼロ」が溜まる。
    await expect(client.fetchPrice('NOTAREALTICKER123')).rejects.toThrow(/0 以下|数値でない/);
  }, 30_000);

  it('エラーに API キーを含めない', async () => {
    const bad = new FinnhubClient({ apiKey: 'invalid-key-for-test' });
    await expect(bad.fetchPrice('SPY')).rejects.toThrow(
      // トークンが載っていないことを確認する。公開リポの Actions ログは誰でも読める。
      expect.not.stringContaining('token='),
    );
  }, 30_000);
});
