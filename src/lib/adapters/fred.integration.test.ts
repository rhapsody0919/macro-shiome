/**
 * 実 FRED API に対する検証。
 *
 * #4 で「ユニットテストは通るのに実データで抽出できない」ことが起きたため、
 * 実 API に対する検証を残す。API キーが無い環境ではスキップされる。
 *
 * 実行方法:
 *   FRED_API_KEY=xxxx pnpm test
 *
 * キーは会話やコミットに貼らないこと (public リポジトリ)。
 */
import { describe, expect, it } from 'vitest';
import { indicators } from '../data/indicators';
import { FredClient } from './fred';

const API_KEY = process.env.FRED_API_KEY ?? '';

describe.skipIf(API_KEY.length === 0)('実 FRED API での検証', () => {
  // describe.skipIf はスキップ時も本体を評価するため、
  // クライアントの生成をテストの中に置く (キー未設定でも読み込み時に落ちないように)。
  const createClient = () => new FredClient({ apiKey: API_KEY });

  it('S&P 500 を取得できる', async () => {
    const observations = await createClient().fetchSeries('SP500', { start: '2026-08-01' });

    expect(Object.keys(observations).length).toBeGreaterThan(0);
    for (const [date, value] of Object.entries(observations)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // 指数は正。桁違いを検出できる程度の幅で見る。
      expect(value).toBeGreaterThan(1000);
      expect(value).toBeLessThan(100_000);
    }
  }, 30_000);

  it('期待インフレ率を取得できる', async () => {
    // イールドスプレッドの計算に必須 (spec F-4)。
    const observations = await createClient().fetchSeries('T10YIE', { start: '2026-08-01' });
    expect(Object.keys(observations).length).toBeGreaterThan(0);
    for (const value of Object.values(observations)) {
      expect(value).toBeGreaterThan(-5);
      expect(value).toBeLessThan(20);
    }
  }, 30_000);

  it('マスタの FRED 系指標をすべて取得できる', async () => {
    // ADR-0004 の狙い (マスタに足すだけで取れる) が実 API でも成り立つことの確認。
    const fredIndicators = Object.entries(indicators).filter(
      ([, indicator]) => indicator.source.adapter === 'fred',
    );

    for (const [id, indicator] of fredIndicators) {
      if (indicator.source.adapter !== 'fred') continue;
      const observations = await createClient().fetchSeries(indicator.source.seriesId, {
        start: '2026-07-01',
      });
      expect(Object.keys(observations).length, `${id} が空`).toBeGreaterThan(0);
    }
  }, 120_000);
});
