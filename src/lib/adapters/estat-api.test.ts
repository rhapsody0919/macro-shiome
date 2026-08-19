import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EstatClient,
  parseStatsData,
  readEstatAppIdFromEnv,
  safeQueryLabel,
  toMonthlyDate,
} from './estat-api';

const query = {
  statsDataId: '0003348423',
  tab: '140',
  cat01: '100',
  cat02: '100',
} as const;

/** 2026-08 時点の実応答を縮めたもの。 */
const body = (values: unknown[]) => ({
  GET_STATS_DATA: {
    RESULT: { STATUS: '0', ERROR_MSG: '正常に終了しました。' },
    STATISTICAL_DATA: { DATA_INF: { VALUE: values } },
  },
});

const row = (time: string, value: string, over: Record<string, string> = {}) => ({
  '@tab': '140',
  '@cat01': '100',
  '@cat02': '100',
  '@time': time,
  $: value,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appId を漏らさない (#160)', () => {
  it('例外のラベルに appId を含めない', () => {
    // public リポの Actions ログは誰でも読める。URL を丸ごと出すと
    // クエリ文字列の appId がそのまま残る。
    const label = safeQueryLabel(query);
    expect(label).toContain('0003348423');
    expect(label).not.toMatch(/appId/i);
  });

  it('HTTP エラーでも appId を出さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const client = new EstatClient({ appId: 'SECRET-VALUE' });
    await expect(client.fetchTable(query)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('SECRET-VALUE') }),
    );
  });

  it('接続失敗でも appId を出さない', async () => {
    // fetch の cause には URL が入ることがある。メッセージだけを取り出している。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED https://api.e-stat.go.jp/?appId=SECRET-VALUE')),
    );
    const client = new EstatClient({ appId: 'SECRET-VALUE' });
    await expect(client.fetchTable(query)).rejects.toThrow(/接続に失敗/);
  });

  it('未設定なら取得前に落とす', () => {
    expect(() => readEstatAppIdFromEnv({})).toThrow(/ESTAT_APP_ID/);
    expect(readEstatAppIdFromEnv({ ESTAT_APP_ID: 'x' })).toBe('x');
  });
});

describe('軸の絞り込み (#160)', () => {
  it('1 種類に絞れていれば取り出す', () => {
    expect(parseStatsData(body([row('2026000606', '44.0'), row('2026000505', '43.6')]), query)).toEqual({
      '2026-06-01': 44.0,
      '2026-05-01': 43.6,
    });
  });

  it('軸が 2 種類あれば落とす', () => {
    // 絞り込みが外れると同じ月に複数の値が入り、最後に読んだものが勝つ形で静かに間違う。
    // 件数だけ見ても気付けない (#96 #129 と同じ型)。
    const mixed = body([row('2026000606', '44.0'), row('2026000606', '45.7', { '@cat02': '110' })]);
    expect(() => parseStatsData(mixed, query)).toThrow(/cat02 が 1 種類に絞れていない/);
  });

  it('条件に合う観測が 0 件なら落とす', () => {
    expect(() => parseStatsData(body([]), query)).toThrow(/観測が 0 件/);
  });

  it('API がエラーを返したら落とす', () => {
    const error = {
      GET_STATS_DATA: { RESULT: { STATUS: '1', ERROR_MSG: '認証に失敗しました。' } },
    };
    expect(() => parseStatsData(error, query)).toThrow(/認証に失敗しました/);
  });

  it('値が数値でなければ落とす', () => {
    // 「-」が入ることがある。黙って欠測にしない。
    expect(() => parseStatsData(body([row('2026000606', '-')]), query)).toThrow(/数値でない/);
  });
});

describe('日付の変換 (#160)', () => {
  it('YYYY00MMMM を月初にする', () => {
    // 統計ダッシュボードの YYYYMM00 とは別形式。取り違えると全部ずれる。
    expect(toMonthlyDate('2026000606')).toBe('2026-06-01');
    expect(toMonthlyDate('1985001010')).toBe('1985-10-01');
  });

  it('月の繰り返しが食い違えば弾く', () => {
    expect(toMonthlyDate('2026000607')).toBeNull();
  });

  it('ダッシュボード形式は受け付けない', () => {
    // YYYYMM00 を渡しても通らないこと。2 つの API を取り違えたら気付ける。
    expect(toMonthlyDate('20260600')).toBeNull();
  });

  it('月が範囲外なら弾く', () => {
    expect(toMonthlyDate('2026001313')).toBeNull();
  });
});
