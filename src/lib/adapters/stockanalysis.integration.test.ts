/**
 * 実 HTML に対する検証。
 *
 * スクレイピングはフィクスチャだけでは実データとの乖離を検出できない
 * (#4 では想定した文言と実 PDF の記述が違い、ユニットテストが通るのに抽出できなかった)。
 *
 * 実行方法 (保存した HTML を指定したときだけ動く):
 *   STOCKANALYSIS_SAMPLE_HTML=/path/to/qqq.html pnpm test
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStockAnalysisField } from './stockanalysis';

const HTML_PATH = process.env.STOCKANALYSIS_SAMPLE_HTML ?? '';

describe.skipIf(!HTML_PATH || !existsSync(HTML_PATH))('実 HTML での検証 (QQQ)', () => {
  it('PER を抽出できる', () => {
    const html = readFileSync(HTML_PATH, 'utf8');
    const pe = parseStockAnalysisField(html, 'peRatio');

    // 値は日々変わるため、範囲で妥当性を見る (plan 4-4 の検証と同じ考え方)。
    expect(pe).toBeGreaterThan(5);
    expect(pe).toBeLessThan(60);
  });
});
