import { describe, expect, it } from 'vitest';
import {
  estatDashboardUrl,
  parseDashboardData,
  toMonthlyDate,
  toQuarterlyDate,
} from './estat-dashboard';

const query = { indicatorCode: '0802010103000010001', cycle: '1', isSeasonal: '2' } as const;

/** 2026-08 時点の実応答を縮めたもの。月次/年度、原数値/季調値が混ざる形を再現する。 */
const BODY = {
  GET_STATS: {
    RESULT: { status: '0', errorMsg: '正常に終了しました。' },
    STATISTICAL_DATA: {
      DATA_INF: {
        DATA_OBJ: [
          { VALUE: { '@time': '20260500', '@cycle': '1', '@isSeasonal': '2', $: '756720' } },
          { VALUE: { '@time': '20260600', '@cycle': '1', '@isSeasonal': '2', $: '786432' } },
          // 原数値。同じ月に別の値が来る。
          { VALUE: { '@time': '20260600', '@cycle': '1', '@isSeasonal': '1', $: '65536' } },
          // 年度。日付が YYYYMM00 の形ではない。
          { VALUE: { '@time': '2025FY00', '@cycle': '4', '@isSeasonal': '2', $: '711171' } },
          // 四半期。
          { VALUE: { '@time': '20260400', '@cycle': '2', '@isSeasonal': '2', $: '200000' } },
        ],
      },
    },
  },
};

describe('統計ダッシュボード (#129)', () => {
  it('月次・季調値だけを取り出す', () => {
    // cycle と isSeasonal の両方で絞らないと、同じ月に 2 つ値が入る (#96 と同じ型)。
    expect(parseDashboardData(BODY, query)).toEqual({
      '2026-05-01': 756720,
      '2026-06-01': 786432,
    });
  });

  it('原数値を指定すればそちらを取る', () => {
    expect(parseDashboardData(BODY, { ...query, isSeasonal: '1' })).toEqual({
      '2026-06-01': 65536,
    });
  });

  it('条件に合う観測が 0 件なら失敗させる', () => {
    // 系列の構成が変わったときに黙って欠測にしない。
    const empty = { GET_STATS: { STATISTICAL_DATA: { DATA_INF: { DATA_OBJ: [] } } } };
    expect(() => parseDashboardData(empty, query)).toThrow(/条件に合う観測が 0 件/);
  });

  it('データが取れなければエラーメッセージを添えて失敗させる', () => {
    const error = {
      GET_STATS: { RESULT: { status: '1', errorMsg: '該当データはありませんでした。' } },
    };
    expect(() => parseDashboardData(error, query)).toThrow(/該当データはありませんでした/);
  });

  it('値が数値でなければ失敗させる', () => {
    const broken = {
      GET_STATS: {
        STATISTICAL_DATA: {
          DATA_INF: {
            DATA_OBJ: [{ VALUE: { '@time': '20260600', '@cycle': '1', '@isSeasonal': '2', $: '-' } }],
          },
        },
      },
    };
    expect(() => parseDashboardData(broken, query)).toThrow(/数値でない/);
  });
});

describe('日付の変換', () => {
  it('YYYYMM00 を月初にする', () => {
    expect(toMonthlyDate('20260600')).toBe('2026-06-01');
  });

  it('年度は弾く', () => {
    // cycle での絞り込みと二重に効かせる。どちらか一方に頼らない。
    expect(toMonthlyDate('2025FY00')).toBeNull();
  });

  it('月が範囲外なら弾く', () => {
    expect(toMonthlyDate('20261300')).toBeNull();
  });
});

describe('四半期の日付の変換 (#336)', () => {
  it('YYYYQQ00 をその期の最終月にする', () => {
    // BSI (#226) が四半期の値をその期の最終月に置くのと同じ規約。
    expect(toQuarterlyDate('20261Q00')).toBe('2026-03-01');
    expect(toQuarterlyDate('20262Q00')).toBe('2026-06-01');
    expect(toQuarterlyDate('20264Q00')).toBe('2026-12-01');
  });

  it('月次や年度の形式は弾く', () => {
    expect(toQuarterlyDate('20260600')).toBeNull();
    expect(toQuarterlyDate('2025FY00')).toBeNull();
  });

  it('cycle=2 で四半期の観測だけを取り出す', () => {
    // 2026-08 時点の実応答 (実質GDP成長率 0705020501000060000) を縮めたもの。
    const body = {
      GET_STATS: {
        RESULT: { status: '0', errorMsg: '正常に終了しました。' },
        STATISTICAL_DATA: {
          DATA_INF: {
            DATA_OBJ: [
              { VALUE: { '@time': '20261Q00', '@cycle': '2', '@isSeasonal': '2', $: '1.9' } },
              { VALUE: { '@time': '20262Q00', '@cycle': '2', '@isSeasonal': '2', $: '1.1' } },
              // 月次の行が混ざっても cycle で弾かれる。
              { VALUE: { '@time': '20260600', '@cycle': '1', '@isSeasonal': '2', $: '99' } },
            ],
          },
        },
      },
    };
    const quarterly = parseDashboardData(body, {
      indicatorCode: '0705020501000060000',
      cycle: '2',
      isSeasonal: '2',
    });
    expect(quarterly).toEqual({ '2026-03-01': 1.9, '2026-06-01': 1.1 });
  });
});

describe('URL の組み立て', () => {
  it('全国・指定した周期で問い合わせる', () => {
    // 地域別は扱わない。RegionCode を省くと全都道府県が返る。
    expect(estatDashboardUrl(query)).toBe(
      'https://dashboard.e-stat.go.jp/api/1.0/Json/getData' +
        '?Lang=JP&IndicatorCode=0802010103000010001&RegionCode=00000&Cycle=1',
    );
  });
});
