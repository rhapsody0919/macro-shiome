import { describe, expect, it } from 'vitest';
import { fetchShillerCape } from './shiller';

/**
 * 実ファイルに対する統合テスト。
 *
 * **フィクスチャは実データの代わりにならない** (#4 の教訓)。ネットワークが要るので
 * 既定ではスキップし、`RUN_INTEGRATION=1` で実行する。API キーは不要。
 */
const run = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!run)('シラーPER (統合、ADR-0010)', () => {
  it('ie_data.xls から CAPE を取れる', async () => {
    const observations = await fetchShillerCape();
    const dates = Object.keys(observations).sort();

    // CAPE は 1881-01 から開始 (P/D/E は 1871-01 からあるが、過去10年平均利益を
    // 要るため10年遅れて始まる)。
    expect(dates[0]).toBe('1881-01-01');
    // 145 年分の月次なので 1,700 件を超える。
    expect(dates.length).toBeGreaterThan(1700);

    // シラーPERは歴史的に 5〜45 の範囲に収まる。桁違いを検出する。
    for (const value of Object.values(observations)) {
      expect(value).toBeGreaterThan(3);
      expect(value).toBeLessThan(60);
    }

    // 直近12か月が月次で欠けなく並んでいるか (取りこぼしの検出)。
    const recent = dates.slice(-12);
    const months = new Set(recent.map((d) => d.slice(0, 7)));
    expect(months.size).toBe(12);
  }, 30_000);
});
