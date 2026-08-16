import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEtfField, parseStockAnalysisField, stockAnalysisEtfUrl } from './stockanalysis';

/** 2026-08 時点の QQQ ページの表構造を再現したもの。 */
const QQQ_HTML = `
<table>
  <tr class="flex flex-col border-b border-default py-1 sm:table-row sm:py-0">
    <td class="whitespace-nowrap px-0.5 py-[1px]">PE Ratio</td>
    <td class="whitespace-nowrap px-0.5 text-left font-semibold sm:text-right">33.62</td>
  </tr>
  <tr>
    <td>Assets</td>
    <td>$350.12B</td>
  </tr>
</table>
`;

describe('parseStockAnalysisField', () => {
  it('PER を抽出する', () => {
    expect(parseStockAnalysisField(QQQ_HTML, 'peRatio')).toBe(33.62);
  });

  it('クラス名や属性が変わっても抽出できる', () => {
    // タグを区切りに潰してから拾うため、スタイル変更には影響されない。
    const restyled = QQQ_HTML.replace(/class="[^"]*"/g, 'data-x="1"');
    expect(parseStockAnalysisField(restyled, 'peRatio')).toBe(33.62);
  });

  it('桁区切りのカンマを扱える', () => {
    const html = '<td>PE Ratio</td><td>1,234.5</td>';
    expect(parseStockAnalysisField(html, 'peRatio')).toBe(1234.5);
  });

  it('ラベルが見つからなければ失敗する', () => {
    // plan U-9: 構造変更で silent に壊れるのを防ぐ。0 件は必ず失敗にする。
    expect(() => parseStockAnalysisField('<td>Assets</td><td>1</td>', 'peRatio')).toThrow(
      /抽出できなかった/,
    );
  });

  it('値が数値でなければ失敗する', () => {
    // "n/a" のような表記を 0 として通すと、PER 0 が蓄積されてしまう。
    expect(() => parseStockAnalysisField('<td>PE Ratio</td><td>n/a</td>', 'peRatio')).toThrow(
      /抽出できなかった/,
    );
  });

  it('値が食い違う箇所が複数あれば失敗する', () => {
    const conflicting = '<td>PE Ratio</td><td>33.62</td><td>PE Ratio</td><td>28.00</td>';
    expect(() => parseStockAnalysisField(conflicting, 'peRatio')).toThrow(/食い違う/);
  });

  it('同じ値が複数箇所にあれば通す', () => {
    const duplicated = '<td>PE Ratio</td><td>33.62</td><td>PE Ratio</td><td>33.62</td>';
    expect(parseStockAnalysisField(duplicated, 'peRatio')).toBe(33.62);
  });

  it('script 内の文字列を拾わない', () => {
    const withScript = `<script>const x = "|PE Ratio|99.9|";</script>${QQQ_HTML}`;
    expect(parseStockAnalysisField(withScript, 'peRatio')).toBe(33.62);
  });
});

describe('stockAnalysisEtfUrl', () => {
  it('小文字のシンボルで URL を組み立てる', () => {
    expect(stockAnalysisEtfUrl('QQQ')).toBe('https://stockanalysis.com/etf/qqq/');
  });
});

describe('fetchEtfField', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('取得した HTML から値を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(QQQ_HTML, { status: 200 })));
    await expect(fetchEtfField('qqq', 'peRatio')).resolves.toBe(33.62);
  });

  it('HTTP エラーは失敗にする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(fetchEtfField('qqq', 'peRatio')).rejects.toThrow(/HTTP 503/);
  });
});
