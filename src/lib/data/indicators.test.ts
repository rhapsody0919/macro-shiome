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

describe('号によって記載が無い項目 (#53)', () => {
  it('翌暦年の予想は optionalInReport が立っている', () => {
    // FactSet は翌暦年の予想を年央 (6 月頃) から載せ始めるため、年前半の号には無い。
    // これを「取得失敗」として記録すると、正常な欠測が毎週の調査対象になる。
    expect(indicators['sp500-growth-cy-next'].optionalInReport).toBe(true);
  });

  it('今暦年の予想は毎号載るため立てない', () => {
    // 実測: PDF が取れた 168 週のうち今暦年の欠落は 1 週だけ。
    expect(indicators['sp500-growth-cy-current'].optionalInReport).toBeUndefined();
  });

  it('真偽値でない値を弾く', () => {
    const valid = {
      name: 'テスト指標',
      source: { adapter: 'factset-pdf', field: 'forwardPe' },
      frequency: 'weekly',
      unit: 'ratio',
      attribution: 'Test Source',
      copyright: 'none',
      group: 'valuation',
    };
    expect(() =>
      parseIndicator('x', { ...valid, optionalInReport: 'yes' }),
    ).toThrow(/optionalInReport/);
  });
});

describe('景気サイクルの分類 (#62)', () => {
  it('S&P 500 は先行指標 (LEI 構成要素)', () => {
    // The Conference Board の LEI に "S&P 500 Index of Stock Prices" が含まれる
    // (2026-08-17 に公式ページで確認)。
    expect(indicators.sp500.cyclePosition).toBe('leading');
  });

  it('NASDAQ-100 は分類しない', () => {
    // LEI の構成要素は S&P 500 のみ。同じ株価指数でも根拠が無いので分類しない。
    expect(indicators.nasdaq100.cyclePosition).toBeUndefined();
  });

  it('為替やボラティリティは分類しない', () => {
    // 景気サイクルの尺度として定義されていない。無理に分類すると
    // 根拠の無い先行性を主張することになる。
    expect(indicators.usdjpy.cyclePosition).toBeUndefined();
    expect(indicators.vix.cyclePosition).toBeUndefined();
  });

  it('未知の分類を弾く', () => {
    const valid = {
      name: 'テスト指標',
      source: { adapter: 'fred', seriesId: 'TESTCYCLE' },
      frequency: 'daily',
      unit: 'index',
      attribution: 'Test Source',
      copyright: 'none',
      group: 'macro',
    };
    expect(() => parseIndicator('x', { ...valid, cyclePosition: 'unknown' })).toThrow(
      /cyclePosition/,
    );
  });

  it('3 つの分類を受け付ける', () => {
    const valid = {
      name: 'テスト指標',
      source: { adapter: 'fred', seriesId: 'TESTCYCLE2' },
      frequency: 'daily',
      unit: 'index',
      attribution: 'Test Source',
      copyright: 'none',
      group: 'macro',
    };
    for (const position of ['leading', 'coincident', 'lagging']) {
      expect(parseIndicator('x', { ...valid, cyclePosition: position }).cyclePosition).toBe(
        position,
      );
    }
  });
});

describe('イールドカーブの指標 (#63)', () => {
  it('先行指標として分類されている', () => {
    // FRED が Interest Rate Spreads カテゴリ + Yield Curve タグで扱う
    // (2026-08-17 に公式ページで確認)。
    expect(indicators.t10y2y.cyclePosition).toBe('leading');
  });

  it('金利グループに入る', () => {
    expect(indicators.t10y2y.group).toBe('rates');
    expect(indicators.t10y2y.unit).toBe('percent');
  });

  it('日次で取得する', () => {
    expect(indicators.t10y2y.frequency).toBe('daily');
  });
});

describe('労働市場・所得の指標 (#66)', () => {
  it('景気一致指数の構成要素だけを coincident にする', () => {
    // The Conference Board の CEI に「非農業部門雇用者数」と
    // 「移転所得を除く個人所得」が含まれる (2026-08-17 に公式ページで確認)。
    expect(indicators.payrolls.cyclePosition).toBe('coincident');
    expect(indicators['real-income-ex-transfer'].cyclePosition).toBe('coincident');
  });

  it('構成要素でない指標は分類しない', () => {
    // 就業者数 (家計調査) は CEI の構成要素ではない。同じ雇用でも根拠が違う。
    expect(indicators['employment-level'].cyclePosition).toBeUndefined();
    expect(indicators['full-time-employment'].cyclePosition).toBeUndefined();
    expect(indicators['savings-rate'].cyclePosition).toBeUndefined();
  });

  it('ミシガン大学の指数は著作権ありとして扱う', () => {
    // FRED 上で Copyrighted と明記されている。出所表示が必須 (spec F-11)。
    expect(indicators['consumer-sentiment'].copyright).toBe('restricted');
    expect(indicators['consumer-sentiment'].attribution).toContain('University of Michigan');
  });

  it('すべて月次', () => {
    for (const id of [
      'payrolls',
      'employment-level',
      'full-time-employment',
      'real-income-ex-transfer',
      'real-disposable-income-per-capita',
      'savings-rate',
      'consumer-sentiment',
    ]) {
      expect(indicators[id].frequency, id).toBe('monthly');
    }
  });
});

describe('住宅市場の指標 (#65)', () => {
  it('建設許可は先行指標 (LEI 構成要素)', () => {
    // The Conference Board の LEI に「新設住宅建設許可」が含まれる
    // (2026-08-17 に公式ページで確認)。
    expect(indicators['building-permits'].cyclePosition).toBe('leading');
  });

  it('着工と販売は構成要素でないため分類しない', () => {
    expect(indicators['housing-starts'].cyclePosition).toBeUndefined();
    expect(indicators['new-home-sales'].cyclePosition).toBeUndefined();
  });

  it('住宅ローン金利は週次で、著作権ありとして扱う', () => {
    // MBA の申請指数が取れないための代替。Freddie Mac に著作権がある。
    expect(indicators['mortgage-rate-30y'].frequency).toBe('weekly');
    expect(indicators['mortgage-rate-30y'].copyright).toBe('restricted');
  });

  it('代替であることが note に記録されている', () => {
    // 申請そのものより先行性が落ちる点を残しておかないと、同等と誤解される。
    expect(indicators['mortgage-rate-30y'].note).toContain('代替');
    expect(indicators['mortgage-rate-30y'].note).toContain('先行性は落ちる');
  });
});

describe('小売売上と景気指数の構成要素 (#72)', () => {
  it('小売売上はコントロールグループではないと記録する', () => {
    // FRED の Advance Retail Sales に建材・外食まで除いた系列は存在しない。
    // 同等と誤解されると別の指標を見ていることになる。
    const note = indicators['retail-sales-core'].note ?? '';
    expect(note).toContain('コントロールグループではない');
    expect(note).toContain('建材と外食が含まれる');
  });

  it('小売売上は分類しない', () => {
    // 景気一致指数の構成要素は「製造業・商業売上高」で、小売売上そのものではない。
    expect(indicators['retail-sales-core'].cyclePosition).toBeUndefined();
  });

  it('新規失業保険申請は週次の先行指標', () => {
    // LEI の構成要素。月次の雇用統計より早く動く。
    expect(indicators['initial-claims'].cyclePosition).toBe('leading');
    expect(indicators['initial-claims'].frequency).toBe('weekly');
  });

  it('鉱工業生産は一致指標', () => {
    // CEI の構成要素。先行指標ではない。
    expect(indicators['industrial-production'].cyclePosition).toBe('coincident');
  });

  it('新規受注 2 系列は先行指標', () => {
    expect(indicators['new-orders-consumer-goods'].cyclePosition).toBe('leading');
    expect(indicators['new-orders-capital-goods'].cyclePosition).toBe('leading');
  });

  it('ISM が取れないことを記録する', () => {
    // LEI の構成要素だが ISM に著作権があり FRED に無い。代替であることを残す。
    expect(indicators['new-orders-consumer-goods'].note).toContain('ISM 新規受注指数は FRED に無い');
  });

  it('追加した 4 指標はすべて Public Domain', () => {
    for (const id of [
      'retail-sales-core',
      'initial-claims',
      'industrial-production',
      'new-orders-consumer-goods',
      'new-orders-capital-goods',
    ]) {
      expect(indicators[id].copyright, id).toBe('none');
    }
  });
});

describe('景気先行指数の残り 2 要素 (#83)', () => {
  it('週平均労働時間は先行指標', () => {
    // LEI の構成要素。解雇の前に残業が減るため雇用者数より早く動く。
    expect(indicators['manufacturing-hours'].cyclePosition).toBe('leading');
    expect(indicators['manufacturing-hours'].copyright).toBe('none');
  });

  it('信用状況は分類しない', () => {
    // LEI の Leading Credit Index は Conference Board 独自の合成指標で公開されていない。
    // Chicago Fed の指数は別物なので、先行と分類する根拠が無い。
    expect(indicators['credit-conditions'].cyclePosition).toBeUndefined();
  });

  it('信用状況が代替であることを記録する', () => {
    expect(indicators['credit-conditions'].note).toContain('Leading Credit Index とは別物');
  });

  it('信用状況は著作権ありとして扱う', () => {
    expect(indicators['credit-conditions'].copyright).toBe('restricted');
    expect(indicators['credit-conditions'].attribution).toContain('Chicago');
  });
});

describe('投資判断の主要指標 (#84)', () => {
  it('信用スプレッドは著作権ありとして扱う', () => {
    // ICE Data Indices に著作権がある。出所表示が必須 (spec F-11)。
    expect(indicators['hy-spread'].copyright).toBe('restricted');
    expect(indicators['ig-spread'].copyright).toBe('restricted');
  });

  it('政策金利・商品・為替・失業率は Public Domain', () => {
    for (const id of ['fed-funds-rate', 'wti', 'dollar-index', 'unemployment-rate']) {
      expect(indicators[id].copyright, id).toBe('none');
    }
  });

  it('失業率は分類しない', () => {
    // 景気遅行指数の構成要素は「平均失業期間」で失業率そのものではない。
    expect(indicators['unemployment-rate'].cyclePosition).toBeUndefined();
    expect(indicators['unemployment-rate'].note).toContain('平均失業期間');
  });

  it('ドル指数が USD/JPY と別物であることを記録する', () => {
    // 2 国間レートと加重平均を混同すると、円だけ動いた局面を読み違える。
    expect(indicators['dollar-index'].note).toContain('2 国間');
  });

  it('日次系列として取得する', () => {
    for (const id of ['hy-spread', 'ig-spread', 'fed-funds-rate', 'wti', 'dollar-index']) {
      expect(indicators[id].frequency, id).toBe('daily');
    }
  });
});
