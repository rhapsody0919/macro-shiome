import { describe, expect, it } from 'vitest';
import { bojDataUrl, parseBojData, toMonthlyDate, toQuarterlyDate } from './boj';

describe('日付の変換 (#228 #338)', () => {
  it('四半期 (YYYYQQ) をその期の最終月に直す', () => {
    expect(toQuarterlyDate('202601')).toBe('2026-03-01');
    expect(toQuarterlyDate('202602')).toBe('2026-06-01');
    expect(toQuarterlyDate('202603')).toBe('2026-09-01');
    expect(toQuarterlyDate('202604')).toBe('2026-12-01');
  });

  it('四半期の形式が不正なら null を返す', () => {
    expect(toQuarterlyDate('202600')).toBeNull();
    expect(toQuarterlyDate('202605')).toBeNull();
    expect(toQuarterlyDate('20260101')).toBeNull();
  });

  it('月次 (YYYYMM) を YYYY-MM-01 に直す', () => {
    expect(toMonthlyDate('202607')).toBe('2026-07-01');
    expect(toMonthlyDate('202601')).toBe('2026-01-01');
    expect(toMonthlyDate('202612')).toBe('2026-12-01');
  });

  it('月次の形式が不正なら null を返す', () => {
    expect(toMonthlyDate('202600')).toBeNull();
    expect(toMonthlyDate('202613')).toBeNull();
  });

  it('四半期の期間番号 (01-04) を超える月次コードは四半期として解釈しない', () => {
    // #160 と同型の罠: 相手の頻度用のコードを渡すと黙って別物を返さず null にする。
    expect(toQuarterlyDate('202612')).toBeNull();
  });
});

describe('bojDataUrl', () => {
  it('db・code・format・lang をクエリに含める', () => {
    const url = bojDataUrl({ db: 'CO', code: 'TK99F1000601GCQ01000', expectedName: 'x' });
    expect(url).toContain('db=CO');
    expect(url).toContain('code=TK99F1000601GCQ01000');
    expect(url).toContain('format=json');
    expect(url).toContain('lang=jp');
  });
});

/** 短観 (db=CO) の実応答を縮めたもの (2026-08-30 に実機確認済み)。 */
const TANKAN_QUERY = {
  db: 'CO',
  code: 'TK99F1000601GCQ01000',
  expectedName: 'D.I./業況/大企業/製造業/実績',
} as const;

const TANKAN_BODY = {
  STATUS: 200,
  MESSAGE: '正常に終了しました。',
  RESULTSET: [
    {
      SERIES_CODE: 'TK99F1000601GCQ01000',
      NAME_OF_TIME_SERIES_J: 'D.I./業況/大企業/製造業/実績',
      UNIT_J: '%ポイント',
      FREQUENCY: 'QUARTERLY',
      VALUES: {
        SURVEY_DATES: [202503, 202504, 202601, 202602],
        VALUES: [12, 13, 14, 22],
      },
    },
  ],
};

/** SPPI (db=PR02) の実応答を縮めたもの。 */
const SPPI_QUERY = {
  db: 'PR02',
  code: 'PRCS20_5200000000%',
  expectedName: '[基本分類指数]  総平均（前年比）',
} as const;

const SPPI_BODY = {
  STATUS: 200,
  MESSAGE: '正常に終了しました。',
  RESULTSET: [
    {
      SERIES_CODE: 'PRCS20_5200000000%',
      NAME_OF_TIME_SERIES_J: '[基本分類指数]  総平均（前年比）',
      UNIT_J: '％',
      FREQUENCY: 'MONTHLY',
      VALUES: {
        SURVEY_DATES: [202605, 202606, 202607],
        VALUES: [3.4, 3.4, 3.6],
      },
    },
  ],
};

describe('parseBojData', () => {
  it('短観 (四半期) の観測を取り出す', () => {
    expect(parseBojData(TANKAN_BODY, TANKAN_QUERY)).toEqual({
      '2025-09-01': 12,
      '2025-12-01': 13,
      '2026-03-01': 14,
      '2026-06-01': 22,
    });
  });

  it('SPPI (月次) の観測を取り出す', () => {
    expect(parseBojData(SPPI_BODY, SPPI_QUERY)).toEqual({
      '2026-05-01': 3.4,
      '2026-06-01': 3.4,
      '2026-07-01': 3.6,
    });
  });

  it('STATUS が 200 でなければ失敗させる', () => {
    const error = { STATUS: 400, MESSAGE: '指定した系列コードは存在しません：1番目のコード' };
    expect(() => parseBojData(error, TANKAN_QUERY)).toThrow(/指定した系列コードは存在しません/);
  });

  it('系列コードが一致しなければ失敗させる', () => {
    const wrongCode = {
      ...TANKAN_BODY,
      RESULTSET: [{ ...TANKAN_BODY.RESULTSET[0], SERIES_CODE: '別のコード' }],
    };
    expect(() => parseBojData(wrongCode, TANKAN_QUERY)).toThrow(/系列コードが一致しない/);
  });

  it('系列名が変わっていれば失敗させる (#66 と同型の取り違え防止)', () => {
    const renamed = {
      ...TANKAN_BODY,
      RESULTSET: [{ ...TANKAN_BODY.RESULTSET[0], NAME_OF_TIME_SERIES_J: '別の名前' }],
    };
    expect(() => parseBojData(renamed, TANKAN_QUERY)).toThrow(/系列名が変わっている/);
  });

  it('日付と値の配列長が不一致なら失敗させる', () => {
    const mismatched = {
      ...TANKAN_BODY,
      RESULTSET: [
        {
          ...TANKAN_BODY.RESULTSET[0],
          VALUES: { SURVEY_DATES: [202601, 202602], VALUES: [1] },
        },
      ],
    };
    expect(() => parseBojData(mismatched, TANKAN_QUERY)).toThrow(/日付と値の配列が不正/);
  });

  it('値が数値でなければ失敗させる', () => {
    const invalid = {
      ...TANKAN_BODY,
      RESULTSET: [
        {
          ...TANKAN_BODY.RESULTSET[0],
          VALUES: { SURVEY_DATES: [202601], VALUES: ['N/A'] },
        },
      ],
    };
    expect(() => parseBojData(invalid, TANKAN_QUERY)).toThrow(/値が数値でない/);
  });

  it('観測が 0 件なら失敗させる', () => {
    const empty = {
      ...TANKAN_BODY,
      RESULTSET: [
        { ...TANKAN_BODY.RESULTSET[0], VALUES: { SURVEY_DATES: [], VALUES: [] } },
      ],
    };
    expect(() => parseBojData(empty, TANKAN_QUERY)).toThrow(/観測が 0 件/);
  });

  it('null の値はスキップする', () => {
    const withNull = {
      ...TANKAN_BODY,
      RESULTSET: [
        {
          ...TANKAN_BODY.RESULTSET[0],
          VALUES: { SURVEY_DATES: [202601, 202602], VALUES: [null, 22] },
        },
      ],
    };
    expect(parseBojData(withNull, TANKAN_QUERY)).toEqual({ '2026-06-01': 22 });
  });
});
