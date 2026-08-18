import { describe, expect, it } from 'vitest';
import { parseAuctions, tenYearAuctionUrl, TreasuryClient } from './treasury';

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
