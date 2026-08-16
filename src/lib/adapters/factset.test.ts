import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FactsetNotPublishedError,
  factsetPdfUrl,
  fetchFactsetReport,
  parseFactsetText,
  previousFriday,
} from './factset';

/**
 * 2026-08-07 号の記述パターンに合わせたフィクスチャ。
 * 実 PDF では forward P/E がサマリーと本文の複数箇所に現れ、平均値は
 * forward が括弧書き・trailing が of 表記で書き分けられている。その構造を再現している。
 */
const REPORT_2026_08_07 = `
Valuation: The forward 12-month P/E ratio for the S&P 500 is 20.0. This P/E ratio is above the
5-year average (19.9) and above the 10-year average (19.0).

The blended (combines actual results for companies that have reported and estimated results for
companies that have yet to report) earnings growth rate for the second quarter is 50.4% today,
compared to an earnings growth rate of 47.4% last week and an earnings growth rate of 23.1% at
the end of the second quarter (June 30).

As a result, the blended revenue growth rate for the second quarter is 15.0% today, compared to a
revenue growth rate of 14.2% last week and a revenue growth rate of 12.2% at the end of the second
quarter (June 30).

For Q3 2026 and Q4 2026, analysts are calling for earnings growth rates of 27.4% and 25.2%.
For CY 2026, analysts are projecting earnings growth of 30.0%.
For CY 2027, analysts are projecting earnings growth of 13.6%.

The forward 12-month P/E ratio is 20.0, which is above the 5-year average (19.9) and above the
10-year average (19.0).

The trailing 12-month P/E ratio is 28.2, which is above the 5-year average of 24.4 and above the
10-year average of 23.5.

The bottom-up target price for the S&P 500 is 9105.91, which is 18.1% above the closing price of
7709.96.
`;

describe('parseFactsetText', () => {
  const extract = parseFactsetText(REPORT_2026_08_07);

  it('Forward / Trailing P/E を抽出する', () => {
    expect(extract.forwardPe).toBe(20.0);
    expect(extract.trailingPe).toBe(28.2);
  });

  it('forward と trailing の平均を取り違えない', () => {
    // forward は括弧書き、trailing は of 表記。近接して現れるため混同しやすい。
    expect(extract.forwardPe5yAvg).toBe(19.9);
    expect(extract.forwardPe10yAvg).toBe(19.0);
    expect(extract.trailingPe5yAvg).toBe(24.4);
    expect(extract.trailingPe10yAvg).toBe(23.5);
  });

  it('PER と同一時点の終値を抽出する', () => {
    // EPS の逆算に使う。FRED の指数を使うと時点がずれる。
    expect(extract.closePrice).toBe(7709.96);
  });

  it('blended 増益率の 3 時点を抽出する', () => {
    // spec F-12 の主目的「予想が先週より上がったか」に直接答える値。
    expect(extract.blendedGrowthToday).toBe(50.4);
    expect(extract.blendedGrowthLastWeek).toBe(47.4);
    expect(extract.blendedGrowthQuarterEnd).toBe(23.1);
  });

  it('次期・翌々期の予想増益率を抽出する', () => {
    expect(extract.growthNextQuarter).toBe(27.4);
    expect(extract.growthQuarterAfterNext).toBe(25.2);
  });

  it('暦年の予想増益率を年の昇順で割り当てる', () => {
    expect(extract.growthCurrentCalendarYear).toBe(30.0);
    expect(extract.growthNextCalendarYear).toBe(13.6);
  });

  it('同じ値が複数箇所に現れても失敗しない', () => {
    // forward P/E はサマリーと本文の 2 箇所に出る。これは正常。
    expect(() => parseFactsetText(REPORT_2026_08_07)).not.toThrow();
  });

  it('値が食い違う箇所があれば失敗する', () => {
    // 文言が変わって別の指標に当たった場合に silent に通さない。
    const broken = `
      The forward 12-month P/E ratio is 20.0.
      The forward 12-month P/E ratio is 25.5.
    `;
    expect(() => parseFactsetText(broken)).toThrow(/食い違う/);
  });

  it('該当する記述が無い項目は欠測にする', () => {
    const partial = 'The forward 12-month P/E ratio is 20.0.';
    const result = parseFactsetText(partial);
    expect(result.forwardPe).toBe(20.0);
    expect(result.trailingPe).toBeUndefined();
    expect(result.closePrice).toBeUndefined();
  });

  it('売上の成長率を増益率と取り違えない', () => {
    // 売上側が同じ構造で書かれているため、earnings を明示しないと誤って拾う。
    expect(extract.blendedGrowthToday).not.toBe(15.0);
  });

  it('括弧内の注釈が短い号にも対応する', () => {
    // 号によって「(year-over-year)」と長い説明文が入れ替わる。
    const shortForm = `
      the blended (year-over-year) earnings growth rate for the third quarter is 12.5% today,
      compared to an earnings growth rate of 11.0% last week and an earnings growth rate of
      8.0% at the end of the third quarter (September 30).
    `;
    const result = parseFactsetText(shortForm);
    expect(result.blendedGrowthToday).toBe(12.5);
    expect(result.blendedGrowthLastWeek).toBe(11.0);
    expect(result.blendedGrowthQuarterEnd).toBe(8.0);
  });

  it('負の増益率を扱える', () => {
    // 減益局面では符号が付く。
    const negative = `
      the blended (year-over-year) earnings growth rate for the first quarter is -5.2% today,
      compared to an earnings growth rate of -3.1% last week and an earnings growth rate of
      -1.0% at the end of the first quarter (March 31).
    `;
    const result = parseFactsetText(negative);
    expect(result.blendedGrowthToday).toBe(-5.2);
    expect(result.blendedGrowthLastWeek).toBe(-3.1);
    expect(result.blendedGrowthQuarterEnd).toBe(-1.0);
  });
});

describe('factsetPdfUrl', () => {
  it('金曜日から MMDDYY 形式の URL を組み立てる', () => {
    const url = factsetPdfUrl(new Date(Date.UTC(2026, 7, 7)));
    expect(url).toContain('EarningsInsight_080726.pdf');
  });

  it('年をまたいでも 2 桁で表現する', () => {
    // 2027-01-08 は金曜日。
    expect(factsetPdfUrl(new Date(Date.UTC(2027, 0, 8)))).toContain('010827.pdf');
  });

  it('金曜以外は呼び出し側の誤りとして弾く', () => {
    // FactSet は金曜発行。他の曜日を投げると必ず 404 になり欠測と区別できなくなる。
    expect(() => factsetPdfUrl(new Date(Date.UTC(2026, 7, 6)))).toThrow(/金曜/);
  });
});

describe('fetchFactsetReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('404 は休刊週として専用エラーにする', async () => {
    // 夏季休刊が実在する (2026 年は 8/14・8/21)。異常ではなく欠測として扱うため、
    // 呼び出し側が取得失敗と区別できる必要がある。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchFactsetReport(new Date(Date.UTC(2026, 7, 14)))).rejects.toBeInstanceOf(
      FactsetNotPublishedError,
    );
  });

  it('404 以外の失敗は通常のエラーにする', async () => {
    // 500 を欠測扱いにすると、障害が「休刊」として静かに記録されてしまう。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const promise = fetchFactsetReport(new Date(Date.UTC(2026, 7, 7)));
    await expect(promise).rejects.toThrow(/HTTP 500/);
    await expect(promise).rejects.not.toBeInstanceOf(FactsetNotPublishedError);
  });
});

describe('previousFriday', () => {
  it('金曜ならその日を返す', () => {
    const friday = previousFriday(new Date(Date.UTC(2026, 7, 7)));
    expect(friday.toISOString().slice(0, 10)).toBe('2026-08-07');
  });

  it('土曜なら前日を返す', () => {
    // バッチは JST 土曜 (UTC 土曜未明) に走る。直近の金曜号を取りに行く。
    const friday = previousFriday(new Date(Date.UTC(2026, 7, 8)));
    expect(friday.toISOString().slice(0, 10)).toBe('2026-08-07');
  });

  it('木曜なら 6 日前を返す', () => {
    const friday = previousFriday(new Date(Date.UTC(2026, 7, 13)));
    expect(friday.toISOString().slice(0, 10)).toBe('2026-08-07');
  });
});
