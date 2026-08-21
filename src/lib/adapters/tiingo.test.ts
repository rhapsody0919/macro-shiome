import { describe, expect, it } from 'vitest';
import { TIINGO_SYMBOLS } from '../data/tiingo-assets';
import { parseOhlcvBars, TiingoClient } from './tiingo';

const validBar = {
  date: '2026-08-20T00:00:00.000Z',
  adjOpen: 770.1,
  adjHigh: 775.5,
  adjLow: 768.2,
  adjClose: 772.6,
  adjVolume: 12_345_678,
};

describe('日足 OHLCV (#229)', () => {
  it('調整済み価格を取り出す', () => {
    expect(parseOhlcvBars([validBar], 'SPY')).toEqual({
      bars: [
        {
          date: '2026-08-20',
          bar: { open: 770.1, high: 775.5, low: 768.2, close: 772.6, volume: 12_345_678 },
        },
      ],
      skipped: [],
    });
  });

  it('複数日分を日付順のまま返す', () => {
    const older = { ...validBar, date: '2026-08-19T00:00:00.000Z', adjClose: 768.0 };
    const { bars } = parseOhlcvBars([older, validBar], 'SPY');
    expect(bars.map((b) => b.date)).toEqual(['2026-08-19', '2026-08-20']);
  });

  it('配列でなければ落ちる', () => {
    expect(() => parseOhlcvBars({}, 'SPY')).toThrow(/配列でない/);
  });

  // 存在しない symbol でも 200 と [] が返ることがある。空を正常として通すと
  // symbol の誤りに気付けなくなる (Finnhub の c=0 と同じ配慮)。
  it('空配列なら落ちる', () => {
    expect(() => parseOhlcvBars([], 'GXG')).toThrow(/応答が空/);
  });

  describe('個々のバーの不正はその日だけスキップする (#229)', () => {
    // 薄商いの ETF で 1 日だけ不正値が混ざっても、他の有効な日まで
    // 巻き添えで失われないようにする (1本の不正で10日分が全滅する事故の防止)。

    it('日付の形式が不正ならその日だけスキップする', () => {
      const bad = { ...validBar, date: '2026/08/20' };
      const { bars, skipped } = parseOhlcvBars([bad], 'SPY');
      expect(bars).toEqual([]);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].reason).toMatch(/日付が不正/);
    });

    it('数値でないフィールドがあればその日だけスキップする', () => {
      const bad = { ...validBar, adjHigh: 'not-a-number' };
      const { bars, skipped } = parseOhlcvBars([bad], 'SPY');
      expect(bars).toEqual([]);
      expect(skipped[0].reason).toMatch(/high が数値でない/);
    });

    it('0 以下のフィールドがあればその日だけスキップする', () => {
      const bad = { ...validBar, adjVolume: 0 };
      const { bars, skipped } = parseOhlcvBars([bad], 'SPY');
      expect(bars).toEqual([]);
      expect(skipped[0].date).toBe('2026-08-20');
      expect(skipped[0].reason).toMatch(/volume が 0 以下/);
    });

    it('1 日だけ不正でも、他の有効な日は失わない', () => {
      const good = { ...validBar, date: '2026-08-19T00:00:00.000Z' };
      const bad = { ...validBar, date: '2026-08-20T00:00:00.000Z', adjVolume: 0 };
      const { bars, skipped } = parseOhlcvBars([good, bad], 'SPY');
      expect(bars.map((b) => b.date)).toEqual(['2026-08-19']);
      expect(skipped.map((s) => s.date)).toEqual(['2026-08-20']);
    });
  });
});

describe('レート制限との関係 (#237)', () => {
  const bar = [{ date: '2026-08-20T00:00:00.000Z', adjOpen: 1, adjHigh: 2, adjLow: 1, adjClose: 2, adjVolume: 10 }];
  const ok = () => Promise.resolve(new Response(JSON.stringify(bar), { status: 200 }));

  it('1 回の実行で投げるのは銘柄数ぶんだけ', async () => {
    // 上限は「1 時間 50 件」というカウント。対象 36 銘柄なら 1 回の実行では当たらない。
    // 間隔を空けても消費は変わらないので、**件数の方を固定する**。
    let calls = 0;
    const client = new TiingoClient({
      apiKey: 'x',
      fetchImpl: () => { calls += 1; return ok(); },
      sleep: () => Promise.resolve(),
    });
    for (const symbol of TIINGO_SYMBOLS) await client.fetchRecentBars(symbol, '2026-08-01');
    expect(calls).toBe(TIINGO_SYMBOLS.length);
    expect(calls).toBeLessThan(50);
  });

  it('再試行の待ちは呼び出し間隔と別に持つ', async () => {
    // 429 は 1 時間枠の使い切り。2 秒待っても回復しない。
    const waits: number[] = [];
    const client = new TiingoClient({
      apiKey: 'x',
      intervalMs: 2_000,
      retryBackoffMs: 60_000,
      maxRetries: 1,
      fetchImpl: () => Promise.resolve(new Response('', { status: 429 })),
      sleep: (ms) => { waits.push(ms); return Promise.resolve(); },
    });
    await expect(client.fetchRecentBars('SPY', '2026-08-01')).rejects.toThrow(/429/);
    expect(waits).toContain(60_000);
    expect(waits).not.toContain(4_000);
  });
});
