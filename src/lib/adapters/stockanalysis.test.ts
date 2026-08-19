import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEtfField,
  parseStockAnalysisField,
  parseStockAnalysisHistory,
  lastClosedTradingDay,
  stockAnalysisEtfUrl,
  stockAnalysisHistoryUrl,
} from './stockanalysis';

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

describe('終値は取らない (#133)', () => {
  it('Previous Close のセルがあっても PE Ratio を取り違えない', () => {
    // ページは当日終値を「価格」として出し、`Previous Close` は 1 つ前の取引日を指す。
    // 値が指す日が違うので同じキーでは保存できず、ゴールドは Finnhub に切り替えた。
    // 表には両方が残るため、ラベルが混ざらないことは引き続き担保する。
    const html =
      '<table><tr><td>PE Ratio</td><td>33.62</td></tr>' +
      '<tr><td>Previous Close</td><td>401.48</td></tr></table>';
    expect(parseStockAnalysisField(html, 'peRatio')).toBe(33.62);
  });

  it('ラベルが無ければ落とす', () => {
    // 構造変更で取れなくなったときに黙って欠測にしない。
    expect(() => parseStockAnalysisField('<table></table>', 'peRatio')).toThrow(/PE Ratio/);
  });
});

describe('値が指す日 (#125 / #172)', () => {
  const at = (iso: string) => lastClosedTradingDay(new Date(iso));

  it('定時実行 (UTC 02:00 = ET 前日 22 時) は前日を指す', () => {
    // 米国東部の前日 21〜22 時。その日のセッションは閉じている。
    expect(at('2026-08-20T02:00:00Z')).toBe('2026-08-19');
  });

  it('引け後に実行しても同じ日を指す (#172)', () => {
    // ET 19:41 の手動実行。以前は常に前営業日を返していたため 1 日ずれ、
    // ETF 36 本の観測が壊れた。定時実行と同じ日を返すのが正しい。
    expect(at('2026-08-19T23:41:00Z')).toBe('2026-08-19');
  });

  it('引け前なら前営業日を指す', () => {
    // ET 14:00。まだその日のセッションは閉じていない。
    expect(at('2026-08-19T18:00:00Z')).toBe('2026-08-18');
  });

  it('引け直後 (ET 16:00) から当日に切り替わる', () => {
    expect(at('2026-08-19T19:59:00Z')).toBe('2026-08-18');
    expect(at('2026-08-19T20:00:00Z')).toBe('2026-08-19');
  });

  it('土日は直前の金曜を指す', () => {
    expect(at('2026-08-23T02:00:00Z')).toBe('2026-08-21');
    expect(at('2026-08-24T02:00:00Z')).toBe('2026-08-21');
  });

  it('夏時間と標準時で境目がずれない', () => {
    // ET は夏時間 (UTC-4) と標準時 (UTC-5) で切り替わる。UTC からの単純な
    // 引き算では引けの判定を誤るため、Intl で東部時間を取り出している。
    // 1 月は標準時: ET 16:00 = UTC 21:00。
    expect(at('2026-01-15T20:59:00Z')).toBe('2026-01-14');
    expect(at('2026-01-15T21:00:00Z')).toBe('2026-01-15');
  });
});

/** 2026-08 時点の GLD 履歴ページの表構造。Date / Open / High / Low / Close / Adj. Close / Change / Volume。 */
const GLD_HISTORY_HTML = `
<table>
  <tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Adj. Close</th><th>Change</th><th>Volume</th></tr>
  <tr><td>Aug 18, 2026</td><td>402.55</td><td>404.32</td><td>397.87</td><td>398.55</td><td>398.55</td><td>-1.71%</td><td>10,378,334</td></tr>
  <tr><td>Aug 17, 2026</td><td>402.34</td><td>406.23</td><td>402.18</td><td>405.49</td><td>405.49</td><td>1.00%</td><td>9,326,162</td></tr>
  <tr><td>Aug 14, 2026</td><td>402.18</td><td>403.33</td><td>400.94</td><td>401.48</td><td>401.48</td><td>0.63%</td><td>6,185,747</td></tr>
</table>`;

describe('履歴ページからの終値 (#133)', () => {
  it('日付と終値の組を取り出す', () => {
    // 4 列目 (Low) ではなく 5 列目 (Close) を拾えていること。
    expect(parseStockAnalysisHistory(GLD_HISTORY_HTML)).toEqual([
      { date: '2026-08-18', close: 398.55 },
      { date: '2026-08-17', close: 405.49 },
      { date: '2026-08-14', close: 401.48 },
    ]);
  });

  it('現在値ページの Previous Close とは 1 取引日ずれる', () => {
    // #133 の原因そのもの。8/18 の引け後に見る `Previous Close` は 8/17 の終値であって
    // 8/18 の終値ではない。履歴ページはこのずれが起こらない。
    const rows = parseStockAnalysisHistory(GLD_HISTORY_HTML);
    const previousCloseOnAug18 = 405.49;
    expect(rows[0]).toEqual({ date: '2026-08-18', close: 398.55 });
    expect(rows.find((r) => r.close === previousCloseOnAug18)?.date).toBe('2026-08-17');
  });

  it('行が無ければ落とす', () => {
    // 構造変更で取れなくなったときに黙って「照合 0 件で緑」にしない。
    expect(() => parseStockAnalysisHistory('<table></table>')).toThrow(/履歴の行を抽出できなかった/);
  });

  it('履歴ページの URL を組み立てる', () => {
    expect(stockAnalysisHistoryUrl('GLD')).toBe('https://stockanalysis.com/etf/gld/history/');
  });
});
