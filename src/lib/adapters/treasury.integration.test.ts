import { describe, expect, it } from 'vitest';
import { TreasuryClient } from './treasury';

/**
 * 実 API に対する統合テスト。
 *
 * **フィクスチャは実データの代わりにならない** (#4 の教訓)。仕様変更や
 * フィルタの取りこぼしはユニットテストでは検出できないため、実 API を叩いて確かめる。
 * ネットワークが要るので既定ではスキップし、`RUN_INTEGRATION=1` で実行する。
 */
const run = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!run)('財務省 API (統合)', () => {
  it('10 年債の応札倍率を取れる', async () => {
    const observations = await new TreasuryClient().fetchTenYearBidToCover();
    const dates = Object.keys(observations).sort();

    // 1999 年 11 月以降で 270 件を超える。極端に少なければフィルタが壊れている。
    // それ以前の入札は応札倍率が記録されていないため件数に入らない。
    expect(dates.length).toBeGreaterThan(270);
    expect(dates[0] >= '1999-11-01').toBe(true);

    // 応札倍率は 1 を割ると札割れで、歴史的に 2 前後。桁違いを検出する。
    for (const value of Object.values(observations)) {
      expect(value).toBeGreaterThan(1);
      expect(value).toBeLessThan(10);
    }

    // 月 1 回のペース。直近 12 件が 18 か月に収まらなければ取りこぼしを疑う。
    const recent = dates.slice(-12);
    const months = new Set(recent.map((d) => d.slice(0, 7)));
    expect(months.size).toBe(12);
  }, 30_000);
});
