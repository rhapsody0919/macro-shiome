import { describe, expect, it } from 'vitest';
import {
  AVG_RATE_SERIES,
  avgRateUrl,
  parseAuctions,
  parseAvgRates,
  parseDebt,
  tenYearAuctionUrl,
  TreasuryClient,
} from './treasury';

/** 実レスポンスと同じ形。 */
const row = (date: string, ratio: string, tips = 'No') => ({
  auction_date: date,
  bid_to_cover_ratio: ratio,
  inflation_index_security: tips,
});

describe('財務省アダプタ (#96)', () => {
  it('入札日をキーに応札倍率を返す', () => {
    expect(parseAuctions({ data: [row('2026-08-12', '2.530000')] })).toEqual({
      '2026-08-12': 2.53,
    });
  });

  it('物価連動債が混ざっていたら落とす', () => {
    // フィルタが効かなくなったら黙って別物を溜めるのではなく気付けるようにする。
    // 実際に 2026-07-23 の 10 年 TIPS が利回り 2.438% で紛れ込む形になっていた。
    expect(() => parseAuctions({ data: [row('2026-07-23', '2.300000', 'Yes')] })).toThrow(
      /物価連動債/,
    );
  });

  it('1 件も無ければ落とす', () => {
    // 空を返すと「入札が無かった」と区別できず、欠測として静かに蓄積する。
    expect(() => parseAuctions({ data: [] })).toThrow(/1 件も取れなかった/);
  });

  it('想定外の形は落とす', () => {
    expect(() => parseAuctions({})).toThrow(/data フィールドが無い/);
    expect(() => parseAuctions({ data: {} })).toThrow(/配列でない/);
    expect(() => parseAuctions({ data: [row('2026/08/12', '2.5')] })).toThrow(/auction_date/);
    // 'null' は欠測だが、それ以外の非数値は仕様変更を疑うので落とす。
    expect(() => parseAuctions({ data: [row('2026-08-12', 'n/a')] })).toThrow(/数値でない/);
  });

  it('応札倍率が記録されていない入札は飛ばす', () => {
    // 1999 年 11 月より前の入札には応札倍率が無い。データ提供の境界であって破損ではない。
    expect(
      parseAuctions({
        data: [row('1998-05-12', 'null'), row('2026-08-12', '2.530000')],
      }),
    ).toEqual({ '2026-08-12': 2.53 });
  });

  it('URL に 3 つの絞り込み条件がすべて入る', () => {
    // 1 つでも欠けるとリオープンが漏れるか TIPS が混ざる (ADR-0006)。
    const url = decodeURIComponent(tenYearAuctionUrl(1000));
    expect(url).toContain('security_type:eq:Note');
    expect(url).toContain('original_security_term:eq:10-Year');
    expect(url).toContain('inflation_index_security:eq:No');
  });

  it('HTTP エラーは握りつぶさない', async () => {
    const client = new TreasuryClient({
      fetchImpl: async () => new Response('', { status: 503 }),
    });
    await expect(client.fetchTenYearBidToCover()).rejects.toThrow(/HTTP 503/);
  });
});

describe('国債の平均利率 (#222)', () => {
  const series = AVG_RATE_SERIES['treasury-avg-rate'];

  it('絞り込みを両方 URL に載せる', () => {
    // 片方だけだと同じ月に複数の値が返る (#129 の cycle / isSeasonal と同じ型)。
    const url = avgRateUrl(series, 1000);
    expect(url).toContain('security_type_desc%3Aeq%3AInterest-bearing+Debt');
    expect(url).toContain('security_desc%3Aeq%3ATotal+Interest-bearing+Debt');
  });

  it('月ごとの値を取り出す', () => {
    const body = {
      data: [
        {
          record_date: '2026-07-31',
          security_type_desc: 'Interest-bearing Debt',
          security_desc: 'Total Interest-bearing Debt',
          avg_interest_rate_amt: '3.447',
        },
      ],
    };
    expect(parseAvgRates(body, series)).toEqual({ '2026-07-31': 3.447 });
  });

  it('別の系列が混ざったら落ちる', () => {
    // フィルタが外れると Non-marketable の Domestic Series (7.577%) が混ざる。
    // 値だけ見ても気付けないため、行ごとに種別を照合する。
    const body = {
      data: [
        {
          record_date: '2026-07-31',
          security_type_desc: 'Non-marketable',
          security_desc: 'Domestic Series',
          avg_interest_rate_amt: '7.577',
        },
      ],
    };
    expect(() => parseAvgRates(body, series)).toThrow(/別の系列が混ざっている/);
  });

  it('同じ月に複数の値があったら落ちる', () => {
    const row = {
      record_date: '2026-07-31',
      security_type_desc: 'Interest-bearing Debt',
      security_desc: 'Total Interest-bearing Debt',
      avg_interest_rate_amt: '3.447',
    };
    expect(() => parseAvgRates({ data: [row, row] }, series)).toThrow(/同じ月に複数の値/);
  });

  it('1 件も取れなければ落ちる', () => {
    // 黙って空を返すと「その月は無かった」と区別できない (#204 と同じ扱い)。
    expect(() => parseAvgRates({ data: [] }, series)).toThrow(/1 件も取れなかった/);
  });
});

describe('国債残高 (#222)', () => {
  it('兆ドルに換算する', () => {
    const body = { data: [{ record_date: '2026-08-18', debt_held_public_amt: '32265798542898.08' }] };
    expect(parseDebt(body)['2026-08-18']).toBeCloseTo(32.2658, 4);
  });

  it('市中保有の内訳が無い日は飛ばす', () => {
    // 2005-04 より前は内訳が報告されていない (実データで 2,958 日)。
    // 提供の境界であって破損ではない。
    const body = {
      data: [
        { record_date: '2005-03-30', debt_held_public_amt: null },
        { record_date: '2026-08-18', debt_held_public_amt: '32265798542898.08' },
      ],
    };
    expect(Object.keys(parseDebt(body))).toEqual(['2026-08-18']);
  });

  it('すべて欠測なら落ちる', () => {
    expect(() => parseDebt({ data: [{ record_date: '2005-03-30', debt_held_public_amt: null }] })).toThrow(
      /1 件も取れなかった/,
    );
  });
});
