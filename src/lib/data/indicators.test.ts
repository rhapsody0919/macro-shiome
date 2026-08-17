import { describe, expect, it } from 'vitest';
import {
  appConfig,
  indicators,
  parseAppConfig,
  parseIndicator,
  parseIndicatorMaster,
  resolveTargetYield,
} from './indicators';

describe('指標マスタ', () => {
  it('実データがパースできる', () => {
    expect(Object.keys(indicators).length).toBeGreaterThan(0);
  });

  it('v1 に必要な指標が揃っている', () => {
    // spec F-4 のイールドスプレッドは実質金利ベースで、DGS10 と T10YIE の両方が要る。
    const required = [
      'sp500',
      'nasdaq100',
      'dgs10',
      't10yie',
      'vix',
      'usdjpy',
      'sp500-forward-pe',
      'sp500-trailing-pe',
      'sp500-close-factset',
      'sp500-growth-cy-current',
      'qqq-trailing-pe',
    ];
    for (const id of required) {
      expect(indicators[id], `${id} が指標マスタに無い`).toBeDefined();
    }
  });

  it('著作権が restricted な指標には出所表記がある', () => {
    // spec F-11 で画面への出所表示が必須のため、値が空だと表示できない。
    for (const [id, indicator] of Object.entries(indicators)) {
      if (indicator.copyright !== 'restricted') continue;
      expect(indicator.attribution.length, `${id} の attribution が空`).toBeGreaterThan(0);
    }
  });

  it('S&P 500 は履歴上限 10 年が記録されている', () => {
    // FRED の契約上 10 年しか取れない。バックフィル範囲の判断に使う。
    expect(indicators.sp500.historyLimit).toBe('10y');
  });

  it('FRED 系はマスタに 1 エントリ足すだけで追加できる', () => {
    // ADR-0004 の狙い。アダプタの実装を変えずに指標を増やせることを保証する。
    // 追加候補 (輸入物価・CPI・PCE 等) の大半がこの形で足りる。
    const added = parseIndicatorMaster({
      cpi: {
        name: '消費者物価指数',
        source: { adapter: 'fred', seriesId: 'CPIAUCSL' },
        frequency: 'monthly',
        unit: 'index',
        attribution: 'U.S. Bureau of Labor Statistics via FRED',
        copyright: 'none',
        group: 'macro',
      },
    });
    expect(added.cpi.source).toEqual({ adapter: 'fred', seriesId: 'CPIAUCSL' });
    expect(added.cpi.frequency).toBe('monthly');
  });
});

describe('指標マスタの検証', () => {
  const valid = {
    name: 'テスト指標',
    source: { adapter: 'fred', seriesId: 'TEST' },
    frequency: 'daily',
    unit: 'index',
    attribution: 'Test Source',
    copyright: 'none',
    group: 'macro',
  };

  it('未知の frequency を弾く', () => {
    expect(() => parseIndicator('x', { ...valid, frequency: 'hourly' })).toThrow(/frequency/);
  });

  it('未知の adapter を弾く', () => {
    expect(() =>
      parseIndicator('x', { ...valid, source: { adapter: 'bloomberg' } }),
    ).toThrow(/adapter/);
  });

  it('FRED なのに seriesId が無いと弾く', () => {
    expect(() => parseIndicator('x', { ...valid, source: { adapter: 'fred' } })).toThrow(
      /seriesId/,
    );
  });

  it('未知の FactSet フィールドを弾く', () => {
    expect(() =>
      parseIndicator('x', { ...valid, source: { adapter: 'factset-pdf', field: 'unknownField' } }),
    ).toThrow(/field/);
  });

  it('attribution が空だと弾く', () => {
    expect(() => parseIndicator('x', { ...valid, attribution: '' })).toThrow(/attribution/);
  });

  it('FRED series の重複を弾く', () => {
    // 同じ系列を別 ID で二重登録すると、同じ値が別指標として蓄積され取り違えの元になる。
    expect(() =>
      parseIndicatorMaster({ a: valid, b: { ...valid, name: '別名' } }),
    ).toThrow(/重複/);
  });
});

describe('基準益回りの設定', () => {
  it('実データがパースできる', () => {
    expect(appConfig.targetYield.sp500.length).toBeGreaterThan(0);
    expect(appConfig.targetYield.nasdaq100.length).toBeGreaterThan(0);
  });

  it('初期値が spec F-13 の決定と一致する', () => {
    expect(resolveTargetYield(appConfig, 'sp500', '2026-08-16')).toBe(3.67);
    expect(resolveTargetYield(appConfig, 'nasdaq100', '2026-08-16')).toBe(3.27);
  });

  it('変更履歴から指定日時点の値を解決する', () => {
    const config = parseAppConfig({
      targetYield: {
        sp500: [
          { value: 4.0, from: '2026-01-01', reason: '旧' },
          { value: 3.67, from: '2026-08-16', reason: '新' },
        ],
        nasdaq100: [{ value: 3.27, from: '2026-01-01', reason: '初期' }],
      },
    });
    expect(resolveTargetYield(config, 'sp500', '2026-08-15')).toBe(4.0);
    expect(resolveTargetYield(config, 'sp500', '2026-08-16')).toBe(3.67);
    expect(resolveTargetYield(config, 'sp500', '2026-12-31')).toBe(3.67);
  });

  it('理由の無い変更を弾く', () => {
    // 前提が変われば見直す値。記録が無いと後から妥当性を判断できない。
    expect(() =>
      parseAppConfig({
        targetYield: {
          sp500: [{ value: 4.0, from: '2026-01-01' }],
          nasdaq100: [{ value: 3.2, from: '2026-01-01', reason: '初期' }],
        },
      }),
    ).toThrow(/reason/);
  });

  it('from が昇順でないと弾く', () => {
    expect(() =>
      parseAppConfig({
        targetYield: {
          sp500: [
            { value: 3.67, from: '2026-08-16', reason: '新' },
            { value: 4.0, from: '2026-01-01', reason: '旧' },
          ],
          nasdaq100: [{ value: 3.2, from: '2026-01-01', reason: '初期' }],
        },
      }),
    ).toThrow(/昇順/);
  });

  it('値が 0 以下だと弾く', () => {
    // 益回り 0 で割ると理論値が無限大になる。
    expect(() =>
      parseAppConfig({
        targetYield: {
          sp500: [{ value: 0, from: '2026-01-01', reason: 'ゼロ' }],
          nasdaq100: [{ value: 3.2, from: '2026-01-01', reason: '初期' }],
        },
      }),
    ).toThrow(/value/);
  });
});

describe('基準益回りの設定時コンテキスト (#46)', () => {
  it('設定時の実質金利を読める', () => {
    const config = parseAppConfig({
      targetYield: {
        sp500: [{ value: 3.67, from: '2026-08-16', reason: '初期', realRateAtSetting: 2.4 }],
        nasdaq100: [{ value: 3.27, from: '2026-08-16', reason: '初期' }],
      },
    });
    expect(config.targetYield.sp500[0].realRateAtSetting).toBe(2.4);
  });

  it('設定時の実質金利は任意 (古い設定に無くても失敗させない)', () => {
    const config = parseAppConfig({
      targetYield: {
        sp500: [{ value: 4.0, from: '2020-01-01', reason: '旧' }],
        nasdaq100: [{ value: 3.2, from: '2020-01-01', reason: '旧' }],
      },
    });
    expect(config.targetYield.sp500[0].realRateAtSetting).toBeUndefined();
  });

  it('数値でない実質金利は弾く', () => {
    expect(() =>
      parseAppConfig({
        targetYield: {
          sp500: [{ value: 3.67, from: '2026-08-16', reason: '初期', realRateAtSetting: '2.4' }],
          nasdaq100: [{ value: 3.27, from: '2026-08-16', reason: '初期' }],
        },
      }),
    ).toThrow(/realRateAtSetting/);
  });
});
