/**
 * 実 PDF に対する検証。
 *
 * ユニットテストのフィクスチャは「こう書かれているはず」という想定に過ぎず、
 * 実際に 2026-08-07 号で検証したところ blended 増益率の括弧内注釈が想定と違い抽出できなかった。
 * 想定と実データの乖離を検出するために、実ファイルでの検証を残す。
 *
 * 実行方法 (PDF を用意したときだけ動く。未指定ならスキップされる):
 *   FACTSET_SAMPLE_PDF=/path/to/EarningsInsight_080726.pdf pnpm test
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPdfText, parseFactsetText } from './factset';

const PDF = process.env.FACTSET_SAMPLE_PDF ?? '';

describe.skipIf(!PDF || !existsSync(PDF))('実 PDF での検証 (2026-08-07 号)', () => {
  it('既知の値をすべて抽出する', async () => {
    const text = await extractPdfText(new Uint8Array(readFileSync(PDF)));
    const extract = parseFactsetText(text);

    expect(extract.forwardPe).toBe(20.0);
    expect(extract.trailingPe).toBe(28.2);
    expect(extract.forwardPe5yAvg).toBe(19.9);
    expect(extract.forwardPe10yAvg).toBe(19.0);
    expect(extract.trailingPe5yAvg).toBe(24.4);
    expect(extract.trailingPe10yAvg).toBe(23.5);
    expect(extract.closePrice).toBe(7709.96);
    expect(extract.blendedGrowthToday).toBe(50.4);
    expect(extract.blendedGrowthLastWeek).toBe(47.4);
    expect(extract.blendedGrowthQuarterEnd).toBe(23.1);
    expect(extract.growthNextQuarter).toBe(27.4);
    expect(extract.growthQuarterAfterNext).toBe(25.2);
    expect(extract.growthCurrentCalendarYear).toBe(30.0);
    expect(extract.growthNextCalendarYear).toBe(13.6);
  }, 60_000);
});
