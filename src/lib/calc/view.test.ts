import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../data/types';
import {
  buildEconomyView,
  buildMacroView,
  buildRevisionSeries,
  buildValuationView,
  type ObservationMap,
} from './view';

const config: AppConfig = {
  targetYield: {
    sp500: [{ value: 4.0, from: '2020-01-01', reason: 'テスト' }],
    nasdaq100: [{ value: 3.2, from: '2020-01-01', reason: 'テスト' }],
  },
};

/** 2026-08-07 号の実測値をもとにした観測値。 */
const observations: ObservationMap = {
  sp500: { '2026-08-07': 7700.0, '2026-08-14': 7785.76 },
  nasdaq100: { '2026-08-07': 29800.0, '2026-08-14': 30046.14 },
  'sp500-close-factset': { '2026-08-07': 7709.96 },
  'sp500-forward-pe': { '2026-08-07': 20.0 },
  'sp500-trailing-pe': { '2026-08-07': 28.2 },
  'sp500-forward-pe-5y-avg': { '2026-08-07': 19.9 },
  'sp500-forward-pe-10y-avg': { '2026-08-07': 19.0 },
  'qqq-trailing-pe': { '2026-08-07': 33.62, '2026-08-14': 34.33 },
  dgs10: { '2026-08-07': 4.63, '2026-08-14': 4.69 },
  t10yie: { '2026-08-07': 2.27, '2026-08-14': 2.24 },
};

const today = new Date(Date.UTC(2026, 7, 15));

describe('buildValuationView', () => {
  const view = buildValuationView({ observations, config, start: '2026-08-01', today });

  it('金曜ごとの点を作る', () => {
    expect(view.sp500.points.map((p) => p.date)).toEqual(['2026-08-07', '2026-08-14']);
  });

  it('EPS を FactSet の終値から逆算する', () => {
    // PER と同一時点の終値を使う。FRED の指数 (7700.0) ではなく 7709.96 で割る。
    const point = view.sp500.points[0];
    expect(point.forwardEps).toBeCloseTo(385.5, 1);
    expect(point.trailingEps).toBeCloseTo(273.4, 1);
  });

  it('イールドスプレッドを実質金利ベースで計算する', () => {
    // 益回り 5.0% − 実質金利 (4.63 − 2.27 = 2.36%) = 2.64%
    const point = view.sp500.points[0];
    expect(point.earningsYield).toBeCloseTo(5.0, 2);
    expect(point.realRate).toBeCloseTo(2.36, 2);
    expect(point.yieldSpread).toBeCloseTo(2.64, 2);
  });

  it('理論値と割高率を計算する', () => {
    // 273.4 ÷ 4.0% = 6835。指数 7700 に対し 11.2% の割高。
    const point = view.sp500.points[0];
    expect(point.fairValue).toBeCloseTo(6835, 0);
    expect(point.overvaluation).toBeCloseTo(11.23, 1);
  });

  it('FactSet が欠測の週は PER 系を null にする', () => {
    // 2026-08-14 は休刊週。前週の値で埋めると欠測が見えなくなる。
    const point = view.sp500.points[1];
    expect(point.forwardPe).toBeNull();
    expect(point.forwardEps).toBeNull();
    expect(point.yieldSpread).toBeNull();
  });

  it('指数は休場日を遡って埋める', () => {
    // 日次系列なので直近の営業日の値を使う。
    expect(view.sp500.points[1].index).toBeCloseTo(7785.76, 2);
  });

  it('指数の欠測は null にする', () => {
    // NaN だと JSON 化で null になり、型と実態がずれる。
    const empty = buildValuationView({
      observations: { ...observations, sp500: {} },
      config,
      start: '2026-08-01',
      today,
    });
    expect(empty.sp500.points[0].index).toBeNull();
  });

  it('基準線に取得日を添える', () => {
    // 固定値ではなく毎週更新される値であることを画面に示すため (spec F-3)。
    expect(view.sp500.baselines).toEqual({ pe5y: 19.9, pe10y: 19.0, asOf: '2026-08-07' });
  });

  it('適用した基準益回りを含める', () => {
    // 理論値は設定依存なので、画面に必ず出せるようビューに持たせる (spec F-13)。
    expect(view.sp500.targetYield).toBe(4.0);
  });

  it('過去最高値のフラグを立てる', () => {
    const highs = view.sp500.points.map((p) => p.isForwardEpsHigh);
    expect(highs[0]).toBe(true);
    // 2 週目は欠測なので更新扱いにしない。
    expect(highs[1]).toBe(false);
  });

  it('標本が少なければ相関を出さない', () => {
    expect(view.sp500.correlation.all.kind).toBe('insufficient');
  });
});

describe('NASDAQ-100 のビュー', () => {
  const view = buildValuationView({ observations, config, start: '2026-08-01', today });

  it('Forward EPS を持たないことを示す', () => {
    // 取得経路が無い (spec D-17)。画面では「蓄積中」と区別して表示する。
    expect(view.nasdaq100.hasForwardEps).toBe(false);
    expect(view.nasdaq100.points[0].forwardEps).toBeNull();
    expect(view.nasdaq100.points[0].forwardPe).toBeNull();
  });

  it('実績 EPS を QQQ の PER から逆算する', () => {
    // 29800 ÷ 33.62 = 886.4
    expect(view.nasdaq100.points[0].trailingEps).toBeCloseTo(886.4, 1);
  });

  it('基準線を持たない', () => {
    // FactSet は S&P 500 専用レポートのため NASDAQ の平均は取れない。
    expect(view.nasdaq100.baselines.asOf).toBeNull();
  });

  it('QQQ の PER は休場日を遡って埋める', () => {
    // 日次で取得するため、週次系列と違い遡ってよい。
    expect(view.nasdaq100.points[1].trailingPe).toBe(34.33);
  });
});

describe('buildRevisionSeries', () => {
  const revisionObservations: ObservationMap = {
    'sp500-blended-growth-today': { '2026-08-07': 50.4 },
    'sp500-blended-growth-last-week': { '2026-08-07': 47.4 },
    'sp500-blended-growth-quarter-end': { '2026-08-07': 23.1 },
    'sp500-growth-cy-current': { '2026-08-07': 30.0 },
    'sp500-growth-cy-next': { '2026-08-07': 13.6 },
  };

  it('3 時点と暦年の予想を並べる', () => {
    const points = buildRevisionSeries({
      observations: revisionObservations,
      config,
      start: '2026-08-01',
      today,
    });

    expect(points[0]).toEqual({
      date: '2026-08-07',
      blendedToday: 50.4,
      blendedLastWeek: 47.4,
      blendedQuarterEnd: 23.1,
      growthCurrentYear: 30.0,
      growthNextYear: 13.6,
    });
  });

  it('休刊週は欠測にする', () => {
    const points = buildRevisionSeries({
      observations: revisionObservations,
      config,
      start: '2026-08-01',
      today,
    });
    expect(points[1].blendedToday).toBeNull();
  });
});

describe('基準益回りの変更履歴', () => {
  it('観測日時点の値を適用する', () => {
    // 前提が変われば見直す値なので、過去の点には当時の値を使う。
    const withHistory: AppConfig = {
      targetYield: {
        sp500: [
          { value: 4.5, from: '2020-01-01', reason: '旧' },
          { value: 4.0, from: '2026-08-10', reason: '新' },
        ],
        nasdaq100: [{ value: 3.2, from: '2020-01-01', reason: 'テスト' }],
      },
    };
    const view = buildValuationView({
      observations,
      config: withHistory,
      start: '2026-08-01',
      today,
    });

    // 2026-08-07 は旧値 4.5% が効く: 273.4 ÷ 4.5% = 6075.6
    expect(view.sp500.points[0].fairValue).toBeCloseTo(6075.6, 0);
  });
});

describe('イールドスプレッドの過去分布 (#52)', () => {
  /** スプレッドが毎週 1 pt ずつ動く系列を作る。 */
  function buildWithSpreads(count: number) {
    const spSeries: Record<string, number> = {};
    const close: Record<string, number> = {};
    const forwardPe: Record<string, number> = {};
    const dgs10: Record<string, number> = {};
    const t10yie: Record<string, number> = {};

    // 2026-08-14 から遡って週次の観測を作る。
    for (let i = 0; i < count; i++) {
      const date = new Date(Date.UTC(2026, 7, 14 - i * 7)).toISOString().slice(0, 10);
      spSeries[date] = 7700;
      close[date] = 7700;
      // 益回りを 5.0% 固定にし、実質金利だけ動かしてスプレッドを変える。
      forwardPe[date] = 20;
      dgs10[date] = 4.0 + i * 0.1;
      t10yie[date] = 2.0;
    }

    return buildValuationView({
      observations: {
        sp500: spSeries,
        'sp500-close-factset': close,
        'sp500-forward-pe': forwardPe,
        dgs10,
        t10yie,
      },
      config,
      start: new Date(Date.UTC(2026, 7, 14 - (count - 1) * 7)).toISOString().slice(0, 10),
      today: new Date(Date.UTC(2026, 7, 15)),
    });
  }

  it('標本が揃えば平均・標準偏差・分位を出す', () => {
    const view = buildWithSpreads(12);
    const dist = view.sp500.spreadDistribution;
    expect(dist).not.toBeNull();
    expect(dist?.n).toBe(12);
    expect(dist?.years).toBe(5);
    // 直近 (i = 0) は実質金利 2.0% で最もスプレッドが大きい → 分位は上位側。
    expect(dist?.latestPercentile).toBeGreaterThan(90);
    expect(dist?.latestDate).toBe('2026-08-14');
  });

  it('標本が足りなければ null (誤解を招く数値を出さない)', () => {
    expect(buildWithSpreads(5).sp500.spreadDistribution).toBeNull();
  });

  it('NASDAQ-100 は PER の履歴が無いため null になる', () => {
    // 実データでも観測値が 1 点しか無く分布を出せない (#54)。
    expect(
      buildValuationView({ observations, config, start: '2026-08-01', today })
        .nasdaq100.spreadDistribution,
    ).toBeNull();
  });
});

describe('労働市場・所得・消費 (#66)', () => {
  const monthly: ObservationMap = {
    // 2026-07 の実データを模した値。報道される雇用統計はプラスだが、
    // 自営業を含む就業者数はマイナスという実際に起きている状況。
    payrolls: { '2025-07-01': 158500, '2026-07-01': 158858 },
    'employment-level': { '2025-07-01': 163150, '2026-07-01': 162177 },
    'full-time-employment': { '2025-07-01': 134900, '2026-07-01': 133553 },
    'real-income-ex-transfer': { '2025-06-01': 16590, '2026-06-01': 16606.1 },
    'savings-rate': { '2026-06-01': 2.7 },
    'consumer-sentiment': { '2026-06-01': 49.5 },
  };

  const view = buildEconomyView({
    observations: monthly,
    config,
    start: '2025-06-01',
    today: new Date(Date.UTC(2026, 6, 20)),
  });

  const july = view.monthly.find((p) => p.month === '2026-07-01');

  it('雇用の 3 系列を前年同月比で持つ', () => {
    expect(july?.payrolls).toBeCloseTo(0.2, 1);
    expect(july?.employmentLevel).toBeCloseTo(-0.6, 1);
    expect(july?.fullTimeEmployment).toBeCloseTo(-1.0, 1);
  });

  it('報道される雇用統計と就業者数の符号が逆になる状況を表現できる', () => {
    // これが記事の主張そのもの。片方だけ見ると実態を見誤る。
    expect((july?.payrolls ?? 0) > 0).toBe(true);
    expect((july?.employmentLevel ?? 0) < 0).toBe(true);
  });

  it('貯蓄率と消費者信頼感は水準のまま持つ', () => {
    // 前年同月比にすると「2.7%」という水準の意味が失われる。
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.savingsRate).toBe(2.7);
    expect(june?.consumerSentiment).toBe(49.5);
  });

  it('発表ラグを指標ごとに持つ', () => {
    const byId = Object.fromEntries(view.coverage.map((c) => [c.indicatorId, c.latestMonth]));
    expect(byId['payrolls']).toBe('2026-07-01');
    expect(byId['savings-rate']).toBe('2026-06-01');
  });
});

describe('住宅市場 (#65)', () => {
  const housing: ObservationMap = {
    'building-permits': { '2026-06-01': 1374 },
    'housing-starts': { '2026-06-01': 1427 },
    'new-home-sales': { '2026-06-01': 628 },
    'mortgage-rate-30y': { '2026-08-13': 6.67 },
  };

  it('住宅 3 指標を水準のまま持つ', () => {
    // 単位が揃っている (千戸) ため水準で比較できる。前年比にすると規模感が失われる。
    const view = buildEconomyView({
      observations: housing,
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 5, 20)),
    });
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.buildingPermits).toBe(1374);
    expect(june?.housingStarts).toBe(1427);
    expect(june?.newHomeSales).toBe(628);
  });

  it('住宅ローン金利は週次グリッドに載せる', () => {
    // 週次なのでマクロ画面 (週次) 側に置く。月次の住宅指標とはページが分かれる。
    const macro = buildMacroView({
      observations: housing,
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(macro.find((p) => p.date === '2026-08-14')?.mortgageRate).toBe(6.67);
  });
});

describe('物価の連鎖 (#64)', () => {
  /** 月次の観測値。前年同月比を出すには 13 か月分が要る。 */
  const monthly: ObservationMap = {
    'import-price': { '2025-06-01': 140.8, '2026-06-01': 150.8 },
    'producer-price': { '2025-06-01': 148.4, '2026-06-01': 156.0 },
    cpi: { '2025-06-01': 321.5, '2026-06-01': 332.8 },
    // PCE は 6 月分が未発表という想定 (発表ラグが指標ごとに違う)。
    'pce-price': { '2025-06-01': 126.7 },
  };

  const view = buildEconomyView({
    observations: monthly,
    config,
    start: '2025-06-01',
    today: new Date(Date.UTC(2026, 5, 20)),
  });

  it('月初の系列を作る', () => {
    expect(view.monthly[0].month).toBe('2025-06-01');
    expect(view.monthly.at(-1)?.month).toBe('2026-06-01');
  });

  it('前年同月比を計算する', () => {
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.importPrice).toBeCloseTo(7.1, 1);
    expect(june?.cpi).toBeCloseTo(3.5, 1);
  });

  it('前年の値が無い月は null', () => {
    // 系列の最初の 12 か月は前年同月が存在しない。
    expect(view.monthly[0].importPrice).toBeNull();
  });

  it('発表ラグを指標ごとに持つ', () => {
    // 「最新」がどの月かは指標で違う。揃っていると誤解させないため個別に持つ。
    const byId = Object.fromEntries(view.coverage.map((c) => [c.indicatorId, c.latestMonth]));
    expect(byId['import-price']).toBe('2026-06-01');
    expect(byId['pce-price']).toBe('2025-06-01');
  });

  it('週次グリッドに載せない (月初のみ)', () => {
    // 月次を週次に落とすと同じ値が 4〜5 週続き、月次だから動かないのか
    // 先週から動いていないのか判別できなくなる。
    for (const point of view.monthly) {
      expect(point.month.endsWith('-01')).toBe(true);
    }
  });
});

describe('イールドカーブ (#63)', () => {
  const withCurve: ObservationMap = {
    ...observations,
    t10y2y: { '2026-08-07': 0.46, '2026-08-14': 0.51 },
  };

  it('週次グリッドに載せる', () => {
    const macro = buildMacroView({ observations: withCurve, config, start: '2026-08-01', today });
    expect(macro.find((p) => p.date === '2026-08-14')?.termSpread).toBe(0.51);
  });

  it('負の値をそのまま持つ (逆イールド)', () => {
    // 符号自体が信号なので、絶対値にしたり 0 で切ったりしない。
    const inverted = buildMacroView({
      observations: { ...observations, t10y2y: { '2026-08-14': -0.42 } },
      config,
      start: '2026-08-01',
      today,
    });
    expect(inverted.find((p) => p.date === '2026-08-14')?.termSpread).toBe(-0.42);
  });

  it('取得できていなければ null', () => {
    const macro = buildMacroView({ observations, config, start: '2026-08-01', today });
    expect(macro.at(-1)?.termSpread).toBeNull();
  });

  it('イールドスプレッドとは別の値', () => {
    // 同じ「スプレッド」だが、株式益回り − 実質金利 とは無関係。
    const macro = buildMacroView({ observations: withCurve, config, start: '2026-08-01', today });
    const valuation = buildValuationView({ observations: withCurve, config, start: '2026-08-01', today });
    const point = macro.find((p) => p.date === '2026-08-07');
    const spread = valuation.sp500.points.find((p) => p.date === '2026-08-07')?.yieldSpread;
    expect(point?.termSpread).toBe(0.46);
    expect(spread).toBeCloseTo(2.64, 1);
  });
});
