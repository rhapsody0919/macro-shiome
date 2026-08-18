/**
 * 実 HTML に対する検証 (#119)。
 *
 * スクレイピングはフィクスチャだけでは実データとの乖離を検出できない (#4)。
 * ネットワークを使うため既定ではスキップし、`RUN_INTEGRATION=1` で実行する。
 */
import { describe, expect, it } from 'vitest';
import { fetchEtfField, stockAnalysisEtfUrl } from './stockanalysis';

const run = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!run)('実 HTML での検証 (GLD)', () => {
  it('終値を抽出できる', async () => {
    const price = await fetchEtfField('GLD', 'previousClose');

    // 値は日々変わるため範囲で見る。GLD 1 株は金 1/10 オンス相当なので、
    // 金が 1,000〜10,000 ドル/オンスの範囲なら 100〜1,000 ドル/株に収まる。
    expect(price).toBeGreaterThan(100);
    expect(price).toBeLessThan(1000);
  }, 30_000);

  it('PER の抽出は壊れていない', async () => {
    // 同じアダプタでフィールドを増やしたので、既存の取得が動くことも確かめる。
    const pe = await fetchEtfField('QQQ', 'peRatio');
    expect(pe).toBeGreaterThan(5);
    expect(pe).toBeLessThan(60);
  }, 30_000);

  it('ETF の URL を組み立てる', () => {
    expect(stockAnalysisEtfUrl('GLD')).toBe('https://stockanalysis.com/etf/gld/');
  });
});
