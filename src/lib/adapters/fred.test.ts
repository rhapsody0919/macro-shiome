import { describe, expect, it, vi } from 'vitest';
import { indicators } from '../data/indicators';
import { FredClient, parseObservations, readFredApiKeyFromEnv } from './fred';

const API_KEY = 'test-api-key-0123456789abcdef';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function client(fetchImpl: typeof fetch, maxRetries = 3) {
  return new FredClient({
    apiKey: API_KEY,
    fetchImpl,
    // テストを待たせないため sleep は即時解決にする。
    sleep: async () => {},
    maxRetries,
    intervalMs: 0,
  });
}

describe('parseObservations', () => {
  it('日付をキーにした観測値に変換する', () => {
    const body = {
      observations: [
        { date: '2026-08-13', value: '4.63' },
        { date: '2026-08-14', value: '4.69' },
      ],
    };
    expect(parseObservations(body, 'DGS10')).toEqual({
      '2026-08-13': 4.63,
      '2026-08-14': 4.69,
    });
  });

  it('欠測 (".") はキーを作らない', () => {
    // FRED は市場休場日を "." で返す。0 で埋めると平均や相関が壊れる。
    // キーが無いことで「取得したが値が無い」と「取得していない」を区別する (ADR-0004)。
    const body = {
      observations: [
        { date: '2026-08-13', value: '4.63' },
        { date: '2026-08-14', value: '.' },
      ],
    };
    const result = parseObservations(body, 'DGS10');
    expect(result).toEqual({ '2026-08-13': 4.63 });
    expect('2026-08-14' in result).toBe(false);
  });

  it('負の値を扱える', () => {
    // 10年-2年スプレッドは逆イールド時に負になる。
    const body = { observations: [{ date: '2026-08-14', value: '-0.35' }] };
    expect(parseObservations(body, 'T10Y2Y')).toEqual({ '2026-08-14': -0.35 });
  });

  it('observations が無いレスポンスを弾く', () => {
    expect(() => parseObservations({ error_message: 'Bad Request' }, 'X')).toThrow(
      /observations/,
    );
  });

  it('数値でない値を弾く', () => {
    // silent に NaN を入れると、もっともらしい欠測として蓄積される。
    const body = { observations: [{ date: '2026-08-14', value: 'N/A' }] };
    expect(() => parseObservations(body, 'X')).toThrow(/数値でない/);
  });
});

describe('FredClient', () => {
  it('series を取得して観測値を返す', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ observations: [{ date: '2026-08-14', value: '7785.76' }] }),
    );
    const result = await client(fetchImpl).fetchSeries('SP500');
    expect(result).toEqual({ '2026-08-14': 7785.76 });
  });

  it('期間を指定できる', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ observations: [] }));
    await client(fetchImpl).fetchSeries('SP500', { start: '2016-08-16', end: '2026-08-16' });

    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.searchParams.get('observation_start')).toBe('2016-08-16');
    expect(url.searchParams.get('observation_end')).toBe('2026-08-16');
  });

  it('5xx を指数バックオフで再試行する', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ observations: [{ date: '2026-08-14', value: '1' }] }));

    const result = await client(fetchImpl).fetchSeries('SP500');
    expect(result).toEqual({ '2026-08-14': 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('4xx は再試行しない', async () => {
    // キーの誤りや存在しない series_id が該当する。再試行しても直らない。
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    await expect(client(fetchImpl).fetchSeries('SP500')).rejects.toThrow(/400/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('再試行の上限を超えたら失敗する', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    await expect(client(fetchImpl, 2).fetchSeries('SP500')).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 初回 + 再試行 2 回
  });

  it('ネットワークエラーも再試行する', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse({ observations: [{ date: '2026-08-14', value: '1' }] }));

    await expect(client(fetchImpl).fetchSeries('SP500')).resolves.toEqual({ '2026-08-14': 1 });
  });

  it('API キーが空ならインスタンス化を拒否する', () => {
    expect(() => new FredClient({ apiKey: '' })).toThrow(/FRED_API_KEY/);
  });
});

describe('API キーの秘匿', () => {
  // public リポの Actions ログは誰でも読める。エラーメッセージに URL をそのまま載せると漏れる。
  it('4xx のエラーメッセージに API キーが含まれない', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(client(fetchImpl).fetchSeries('SP500')).rejects.toThrow(
      expect.not.stringContaining(API_KEY) as unknown as string,
    );
  });

  it('5xx のエラーメッセージに API キーが含まれない', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    try {
      await client(fetchImpl, 0).fetchSeries('SP500');
      expect.unreachable('例外が投げられるはず');
    } catch (error) {
      expect(error instanceof Error ? error.message : '').not.toContain(API_KEY);
    }
  });

  it('ネットワークエラーのメッセージに API キーが含まれない', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    try {
      await client(fetchImpl, 0).fetchSeries('SP500');
      expect.unreachable('例外が投げられるはず');
    } catch (error) {
      expect(error instanceof Error ? error.message : '').not.toContain(API_KEY);
    }
  });
});

describe('readFredApiKeyFromEnv', () => {
  it('環境変数から読む', () => {
    expect(readFredApiKeyFromEnv({ FRED_API_KEY: 'abc' })).toBe('abc');
  });

  it('未設定なら実行を止める', () => {
    // 空のキーで走らせると 400 が返るだけで原因が分かりにくい。入口で止める。
    expect(() => readFredApiKeyFromEnv({})).toThrow(/FRED_API_KEY/);
    expect(() => readFredApiKeyFromEnv({ FRED_API_KEY: '' })).toThrow(/FRED_API_KEY/);
  });
});

describe('指標マスタとの連携 (ADR-0004)', () => {
  it('マスタの FRED 系指標をそのまま取得できる', async () => {
    // 新しい FRED 系指標を足すとき、このアダプタの変更は不要であることの確認。
    const fredIndicators = Object.entries(indicators).filter(
      ([, indicator]) => indicator.source.adapter === 'fred',
    );
    expect(fredIndicators.length).toBeGreaterThan(0);

    // Response の body は一度しか読めないため、呼び出しごとに新しく作る。
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ observations: [{ date: '2026-08-14', value: '1.23' }] }),
    ) as unknown as typeof fetch;
    const fred = client(fetchImpl);

    for (const [, indicator] of fredIndicators) {
      if (indicator.source.adapter !== 'fred') continue;
      await expect(fred.fetchSeries(indicator.source.seriesId)).resolves.toEqual({
        '2026-08-14': 1.23,
      });
    }

    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(fredIndicators.length);
  });
});
