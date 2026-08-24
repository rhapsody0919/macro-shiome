import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../data/types';
import {
  buildEconomyView,
  buildMacroView,
  buildRevisionSeries,
  buildDrawdownView,
  buildDailyView,
  buildValuationView,
  quarterlyGrowth,
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
    // 273.4 ÷ 4.0% = 6835。FactSet 終値 7709.96 に対し 11.3% の割高。
    const point = view.sp500.points[0];
    expect(point.fairValue).toBeCloseTo(6835, 0);
    // **比較基準は FactSet 終値 7709.96** (#110)。指数 7700.0 と比べていた頃は
    // 11.23% だったが、EPS の元になった終値と揃えたことで 11.35% になる。
    expect(point.fairValueBasis).toBe(7709.96);
    expect(point.overvaluation).toBeCloseTo(11.35, 1);
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
    // 実績側の平均はこのフィクスチャに無いため null (#116)。
    expect(view.sp500.baselines).toEqual({
      pe5y: 19.9,
      pe10y: 19.0,
      trailingPe5y: null,
      trailingPe10y: null,
      asOf: '2026-08-07',
    });
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
      // 四半期はこのフィクスチャに無いため null (#117)。
      growthNextQuarter: null,
      growthQuarterAfterNext: null,
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

describe('PER の過去分布 (#271)', () => {
  /** Forward/実績 PER が毎週動く系列を作る。 */
  function buildWithPe(count: number) {
    const spSeries: Record<string, number> = {};
    const close: Record<string, number> = {};
    const forwardPe: Record<string, number> = {};
    const trailingPe: Record<string, number> = {};
    const dgs10: Record<string, number> = {};
    const t10yie: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const date = new Date(Date.UTC(2026, 7, 14 - i * 7)).toISOString().slice(0, 10);
      spSeries[date] = 7700;
      close[date] = 7700;
      forwardPe[date] = 20 - i * 0.1;
      trailingPe[date] = 25 - i * 0.1;
      dgs10[date] = 4.0;
      t10yie[date] = 2.0;
    }

    return buildValuationView({
      observations: {
        sp500: spSeries,
        'sp500-close-factset': close,
        'sp500-forward-pe': forwardPe,
        'sp500-trailing-pe': trailingPe,
        dgs10,
        t10yie,
      },
      config,
      start: new Date(Date.UTC(2026, 7, 14 - (count - 1) * 7)).toISOString().slice(0, 10),
      today: new Date(Date.UTC(2026, 7, 15)),
    });
  }

  it('標本が揃えば Forward/実績それぞれの分位を出す', () => {
    const view = buildWithPe(12);
    const fwd = view.sp500.forwardPeDistribution;
    const trl = view.sp500.trailingPeDistribution;
    expect(fwd).not.toBeNull();
    expect(trl).not.toBeNull();
    expect(fwd?.n).toBe(12);
    expect(trl?.n).toBe(12);
    // 直近 (i = 0) が最も高い値 → 分位は上位側。
    expect(fwd?.latestPercentile).toBeGreaterThan(90);
    expect(trl?.latestPercentile).toBeGreaterThan(90);
  });

  it('標本が足りなければ null (誤解を招く数値を出さない)', () => {
    const view = buildWithPe(5);
    expect(view.sp500.forwardPeDistribution).toBeNull();
    expect(view.sp500.trailingPeDistribution).toBeNull();
  });

  it('NASDAQ-100 は Forward PER の取得経路が無いため常に null', () => {
    // trailingPe (QQQ 経由) も本テストの観測値には含めていないため null になる。
    const view = buildWithPe(12);
    expect(view.nasdaq100.forwardPeDistribution).toBeNull();
    expect(view.nasdaq100.trailingPeDistribution).toBeNull();
  });
});

describe('シラーPER (CAPE) のビュー (#291)', () => {
  /** 月次で `count` か月ぶんの CAPE 観測を作る (直近月から遡る)。 */
  function buildWithCape(count: number, todayDate: Date) {
    const shillerPe: Record<string, number> = {};
    for (let i = 0; i < count; i++) {
      const date = new Date(
        Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - i, 1),
      )
        .toISOString()
        .slice(0, 10);
      shillerPe[date] = 20 + i * 0.1;
    }
    return buildValuationView({
      observations: { 'shiller-pe': shillerPe },
      config,
      // 直近 1 年しか無くても、シラーPERは観測の最古月から表示する (下の別テストで確認)。
      start: new Date(Date.UTC(todayDate.getUTCFullYear() - 1, todayDate.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10),
      today: todayDate,
    });
  }

  it('標本が揃えば過去分布を出す', () => {
    const view = buildWithCape(24, today);
    expect(view.shillerPe.distribution).not.toBeNull();
    expect(view.shillerPe.distribution?.n).toBe(24);
    // 直近 (i = 0) が最も低い値 → 分位は下位側。
    expect(view.shillerPe.distribution?.latestPercentile).toBeLessThan(10);
  });

  it('標本が足りなければ null (誤解を招く数値を出さない)', () => {
    const view = buildWithCape(5, today);
    expect(view.shillerPe.distribution).toBeNull();
  });

  it('観測が無ければ空配列と null', () => {
    const view = buildValuationView({ observations: {}, config, start: '2026-08-01', today });
    expect(view.shillerPe.points).toEqual([]);
    expect(view.shillerPe.distribution).toBeNull();
  });

  it('options.start (10年上限) に縛られず、観測の最古月から表示する', () => {
    // CAPE の価値は長期の文脈にあるため、他の系列と同じ上限に切り詰めない。
    const view = buildValuationView({
      observations: { 'shiller-pe': { '1990-01-01': 18.0, '2026-08-01': 41.0 } },
      config,
      start: '2026-01-01',
      today,
    });
    expect(view.shillerPe.points[0]?.date).toBe('1990-01-01');
  });
});

describe('労働市場・所得・消費 (#66)', () => {
  const monthly: ObservationMap = {
    // 2026-07 の実データを模した値。報道される雇用統計はプラスだが、
    // 自営業を含む就業者数はマイナスという実際に起きている状況。
    payrolls: { '2025-07-01': 158500, '2026-07-01': 158858 },
    'employment-level': { '2025-07-01': 163150, '2026-07-01': 162177 },
    'full-time-employment': { '2025-07-01': 134900, '2026-07-01': 133553 },
    'adp-employment': { '2025-07-01': 132200000, '2026-07-01': 132763000 },
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

  it('ADP雇用者数も前年同月比で持つ (#295)', () => {
    // 生の人数 (千人ではない) だが、前年同月比にすれば桁の違いは関係なくなる。
    expect(july?.adpEmployment).toBeCloseTo(0.43, 1);
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

describe('10年債の理論値 (#93)', () => {
  /**
   * 実データ (data/observations/potential-gdp.json)。
   * GDPPOT 2025Q3 = 23,680.2 / 2026Q3 = 24,200.4 → 前年同期比 2.197%。
   */
  const rates: ObservationMap = {
    dgs10: { '2026-08-14': 4.68 },
    t10yie: { '2026-08-14': 2.27 },
    'potential-gdp': {
      '2025-07-01': 23680.2,
      '2025-10-01': 23811.2,
      '2026-07-01': 24200.4,
    },
  };

  const build = (observations: ObservationMap) =>
    buildMacroView({
      observations,
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 15)),
    });

  it('潜在成長率を前年同期比で出す', () => {
    // 24200.4 / 23680.2 - 1 = 2.197%。四半期の水準そのままではない。
    const point = build(rates).find((p) => p.date === '2026-08-14');
    expect(point?.potentialGrowth).toBeCloseTo(2.197, 2);
  });

  it('理論値は期待インフレ率 + 潜在成長率', () => {
    const point = build(rates).find((p) => p.date === '2026-08-14');
    // 2.27 + 2.197 = 4.467。実際の 4.68% との乖離は +0.21pt。
    expect(point?.treasuryFairValue).toBeCloseTo(4.467, 2);
    // 実際の名目 (4.68%) は理論値を上回っている。
    expect(point?.nominalRate).toBe(4.68);
  });

  it('四半期の値を週次グリッドに前方補完する', () => {
    // 8/14 時点で最新の四半期は 7/1。90 日近く遡る必要がある。
    const point = build(rates).find((p) => p.date === '2026-08-07');
    expect(point?.potentialGrowth).toBeCloseTo(2.197, 2);
  });

  it('1 年前の四半期が無い期は潜在成長率を出さない', () => {
    // 片側だけで比率を出すと別物になる。欠測として扱う。
    const point = build({
      ...rates,
      'potential-gdp': { '2026-07-01': 28787.1 },
    }).find((p) => p.date === '2026-08-14');
    expect(point?.potentialGrowth).toBeNull();
    expect(point?.treasuryFairValue).toBeNull();
  });

  it('潜在GDP が無くても他の系列は壊れない', () => {
    const point = build({ dgs10: rates.dgs10, t10yie: rates.t10yie }).find(
      (p) => p.date === '2026-08-14',
    );
    expect(point?.potentialGrowth).toBeNull();
    expect(point?.realRate).toBeCloseTo(2.41, 2);
  });
});

describe('四半期系列の前年同期比 (#93)', () => {
  it('年だけ戻した日付を 1 年前とみなす', () => {
    // 観測日は四半期の初日に揃っているので、年を戻せば同じ四半期になる。
    expect(quarterlyGrowth({ '2025-04-01': 100, '2026-04-01': 102 })).toEqual({
      '2026-04-01': expect.closeTo(2, 10),
    });
  });

  it('1 年前が無い期は含めない', () => {
    expect(quarterlyGrowth({ '2026-04-01': 102 })).toEqual({});
  });

  it('四半期がずれている場合は比較しない', () => {
    // 4-1 の 1 年前は 4-1。1-1 とは比べない。
    expect(quarterlyGrowth({ '2025-01-01': 100, '2026-04-01': 102 })).toEqual({});
  });
});

describe('地区連銀サーベイ (#94)', () => {
  it('拡散指数は水準のまま載せる', () => {
    // 0 が「改善と悪化が同数」という定義上の基準なので、前年同月比にすると意味を失う。
    const view = buildEconomyView({
      observations: {
        'ny-fed-survey': { '2025-08-01': 5.4, '2026-08-01': -12.5 },
        'philly-fed-survey': { '2026-08-01': 3.1 },
      },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const august = view.monthly.find((p) => p.month === '2026-08-01');
    expect(august?.nyFedSurvey).toBe(-12.5);
    expect(august?.phillyFedSurvey).toBe(3.1);
  });

  it('発表状況に 2 系列が入る', () => {
    // 発表ラグが指標ごとに違うため、系列単位で対象月を出す (#64)。
    const view = buildEconomyView({
      observations: { 'ny-fed-survey': { '2026-08-01': -12.5 } },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const ids = view.coverage.map((c) => c.indicatorId);
    expect(ids).toContain('ny-fed-survey');
    expect(ids).toContain('philly-fed-survey');
    expect(view.coverage.find((c) => c.indicatorId === 'ny-fed-survey')?.latestMonth).toBe(
      '2026-08-01',
    );
  });
});

describe('S&P500 の前年比 (#287)', () => {
  it('日次系列を月初時点の前年同日比で拾う', () => {
    // 地区連銀サーベイ (拡散指数) と重ねて表示するため、桁が違う指数は
    // 前年同日比に揃える (#118 と同じ理由)。
    const view = buildEconomyView({
      observations: {
        sp500: { '2025-08-01': 5000, '2026-08-01': 5500 },
      },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const august = view.monthly.find((p) => p.month === '2026-08-01');
    expect(august?.sp500Yoy).toBeCloseTo(10, 10);
  });

  it('月初が休場でも直近の営業日まで遡る', () => {
    // 日次系列なので月初ちょうどの観測が無いことがある。
    const view = buildEconomyView({
      observations: {
        sp500: { '2025-07-31': 4900, '2026-07-31': 5390 },
      },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const august = view.monthly.find((p) => p.month === '2026-08-01');
    expect(august?.sp500Yoy).toBeCloseTo(10, 10);
  });
});

describe('家計の余力 (#95)', () => {
  const build = (observations: ObservationMap) =>
    buildEconomyView({
      observations,
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });

  it('貯蓄額は前年同月比、貯蓄率は水準で出す', () => {
    // 率と金額は桁が違う。率は 0 を基準に読むので水準のまま、金額は変化率にする。
    const view = build({
      'savings-rate': { '2026-06-01': 2.7 },
      'personal-saving': { '2025-06-01': 1000, '2026-06-01': 900 },
    });
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.savingsRate).toBe(2.7);
    expect(june?.personalSaving).toBeCloseTo(-10, 10);
  });

  it('実質可処分所得を総額と1人当たりの両方で出す', () => {
    // 人口が増えるため、総額が横ばいでも 1 人当たりでは減っていることがある。
    const view = build({
      'real-disposable-income': { '2025-06-01': 100, '2026-06-01': 100 },
      'real-disposable-income-per-capita': { '2025-06-01': 100, '2026-06-01': 99 },
    });
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.realDisposableTotal).toBeCloseTo(0, 10);
    expect(june?.realDisposablePerCapita).toBeCloseTo(-1, 10);
  });

  it('発表状況に 2 系列が入る', () => {
    const ids = build({}).coverage.map((c) => c.indicatorId);
    expect(ids).toContain('personal-saving');
    expect(ids).toContain('real-disposable-income');
  });
});

describe('10年債利回りの国際比較 (#97)', () => {
  it('3 か国とも水準のまま載せる', () => {
    // 金利は水準そのものが意味を持つ。前年同月比にすると比較にならない。
    const view = buildEconomyView({
      observations: {
        'us-10y-monthly': { '2026-06-01': 4.47 },
        'jp-10y': { '2026-06-01': 2.67 },
        'de-10y': { '2026-06-01': 2.97 },
      },
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.usTenYearMonthly).toBe(4.47);
    expect(june?.jpTenYear).toBe(2.67);
    expect(june?.deTenYear).toBe(2.97);
  });

  it('発表状況に 3 系列が入る', () => {
    const ids = buildEconomyView({
      observations: {},
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    }).coverage.map((c) => c.indicatorId);
    for (const id of ['us-10y-monthly', 'jp-10y', 'de-10y']) {
      expect(ids).toContain(id);
    }
  });
});

describe('交易条件 (#98)', () => {
  it('輸出物価も前年同月比で出す', () => {
    // 輸入物価と同じ軸で比べるため、基準年の違いを消して前年同月比に揃える。
    const view = buildEconomyView({
      observations: {
        'import-price': { '2025-06-01': 140.8, '2026-06-01': 150.8 },
        'export-price': { '2025-06-01': 150.0, '2026-06-01': 153.0 },
      },
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });
    const june = view.monthly.find((p) => p.month === '2026-06-01');
    expect(june?.importPrice).toBeCloseTo(7.10, 2);
    expect(june?.exportPrice).toBeCloseTo(2.0, 2);
  });

  it('発表状況に輸出物価が入る', () => {
    const ids = buildEconomyView({
      observations: {},
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    }).coverage.map((c) => c.indicatorId);
    expect(ids).toContain('export-price');
  });
});

describe('10年債入札の応札倍率 (#96)', () => {
  const build = (observations: ObservationMap) =>
    buildEconomyView({
      observations,
      config,
      start: '2026-06-01',
      today: new Date(Date.UTC(2026, 7, 20)),
    });

  it('月内のどの日付でもその月に載せる', () => {
    // 入札日は月ごとに動く。月初ちょうどを見る通常の判定では拾えない。
    const view = build({ 'ten-year-bid-to-cover': { '2026-08-12': 2.53 } });
    expect(view.monthly.find((p) => p.month === '2026-08-01')?.bidToCover).toBe(2.53);
  });

  it('入札が無い月は欠測にする', () => {
    const view = build({ 'ten-year-bid-to-cover': { '2026-08-12': 2.53 } });
    expect(view.monthly.find((p) => p.month === '2026-07-01')?.bidToCover).toBeNull();
  });

  it('同じ月に複数あれば後の入札を使う', () => {
    const view = build({
      'ten-year-bid-to-cover': { '2026-08-05': 2.3, '2026-08-12': 2.53 },
    });
    expect(view.monthly.find((p) => p.month === '2026-08-01')?.bidToCover).toBe(2.53);
  });

  it('発表状況は入札があった月を指す', () => {
    // 月初ちょうどの値を見る判定だと null になってしまう (#96)。
    const view = build({ 'ten-year-bid-to-cover': { '2026-07-08': 2.59 } });
    expect(view.coverage.find((c) => c.indicatorId === 'ten-year-bid-to-cover')?.latestMonth).toBe(
      '2026-07-01',
    );
  });
});

describe('割高率の比較基準 (#110)', () => {
  /**
   * FactSet の終値はレポート日の**前営業日**の値。実データで確認済み
   * (2026-08-07 号の 7709.96 は FRED の 2026-08-06 と完全一致)。
   */
  const observations: ObservationMap = {
    sp500: { '2026-08-06': 7709.96, '2026-08-07': 7757.64 },
    'sp500-close-factset': { '2026-08-07': 7709.96 },
    'sp500-trailing-pe': { '2026-08-07': 28.2 },
    nasdaq100: { '2026-08-07': 30046.14 },
    'qqq-trailing-pe': { '2026-08-07': 33.62 },
  };
  const view = buildValuationView({
    observations,
    config,
    start: '2026-08-01',
    today: new Date(Date.UTC(2026, 7, 8)),
  });
  const sp = view.sp500.points.find((p) => p.date === '2026-08-07');

  it('比較基準は FactSet の終値で、指数とは別の値になる', () => {
    // 指数は金曜終値、EPS の元は前営業日の終値。ここが揃っていないと割高率がずれる。
    expect(sp?.index).toBe(7757.64);
    expect(sp?.fairValueBasis).toBe(7709.96);
  });

  it('割高率は比較基準に対して計算する', () => {
    const fair = sp?.fairValue as number;
    expect(sp?.overvaluation).toBeCloseTo((1 - fair / 7709.96) * 100, 10);
    // 指数と比べた場合とは 0.6pt ほど違う。これが #110 で直したずれ。
    expect(Math.abs((sp?.overvaluation as number) - (1 - fair / 7757.64) * 100)).toBeGreaterThan(0.5);
  });

  it('NASDAQ-100 は指数そのものが比較基準になる', () => {
    // FactSet の終値が無く、EPS も指数から作るので時点のずれが生じない。
    const ndx = view.nasdaq100.points.find((p) => p.date === '2026-08-07');
    expect(ndx?.fairValueBasis).toBe(ndx?.index);
  });
});

describe('実績 P/E の基準線 (#116)', () => {
  /** 実測値。Forward と実績で平均の水準が違う (19.9 vs 24.4)。 */
  const observations: ObservationMap = {
    sp500: { '2026-08-07': 7757.64 },
    'sp500-forward-pe': { '2026-08-07': 20.0 },
    'sp500-trailing-pe': { '2026-08-07': 28.2 },
    'sp500-forward-pe-5y-avg': { '2026-08-07': 19.9 },
    'sp500-forward-pe-10y-avg': { '2026-08-07': 19.0 },
    'sp500-trailing-pe-5y-avg': { '2026-08-07': 24.4 },
    'sp500-trailing-pe-10y-avg': { '2026-08-07': 23.5 },
  };
  const view = buildValuationView({
    observations,
    config,
    start: '2026-08-01',
    today: new Date(Date.UTC(2026, 7, 8)),
  });

  it('Forward と実績の平均を別々に持つ', () => {
    // 取り違えると、違う種類の PER と平均を比べることになる。
    expect(view.sp500.baselines).toMatchObject({
      pe5y: 19.9,
      pe10y: 19.0,
      trailingPe5y: 24.4,
      trailingPe10y: 23.5,
      asOf: '2026-08-07',
    });
  });

  it('NASDAQ-100 には基準線が無い', () => {
    // QQQ 経由では現在値しか取れず、FactSet の平均も存在しない。
    expect(view.nasdaq100.baselines).toEqual({
      pe5y: null,
      pe10y: null,
      trailingPe5y: null,
      trailingPe10y: null,
      asOf: null,
    });
  });
});

describe('四半期の予想増益率 (#117)', () => {
  it('翌四半期・翌々四半期をビューに載せる', () => {
    // 暦年と違い、対象四半期は時間とともに入れ替わる。値はそのまま載せて
    // 「対象が動く」ことは画面の注記で伝える。
    const points = buildRevisionSeries({
      observations: {
        'sp500-growth-next-quarter': { '2026-08-07': 12.4 },
        'sp500-growth-quarter-after-next': { '2026-08-07': 15.1 },
      },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 8)),
    });
    expect(points[0]).toMatchObject({
      date: '2026-08-07',
      growthNextQuarter: 12.4,
      growthQuarterAfterNext: 15.1,
    });
  });

  it('発行日ちょうどで引く (遡らない)', () => {
    // 遡ると休刊週が前週の値で埋まり、欠測が見えなくなる (既存の暦年と同じ扱い)。
    const points = buildRevisionSeries({
      observations: { 'sp500-growth-next-quarter': { '2026-07-31': 12.4 } },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 8)),
    });
    expect(points[0].growthNextQuarter).toBeNull();
  });
});

describe('日経平均 (#118)', () => {
  it('日本の休場日は直近の営業日まで遡る', () => {
    // 2026-08-11 は山の日で東証が休場。FRED は空値を返す。
    const view = buildMacroView({
      observations: { nikkei225: { '2026-08-07': 67000, '2026-08-14': 68713.8 } },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(view.find((p) => p.date === '2026-08-14')?.nikkei225).toBe(68713.8);
  });

  it('金曜が休場なら前営業日の値を使う', () => {
    const view = buildMacroView({
      observations: { nikkei225: { '2026-08-13': 68308.59 } },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(view.find((p) => p.date === '2026-08-14')?.nikkei225).toBe(68308.59);
  });
});

describe('ゴールド (#119)', () => {
  it('週次グリッドに載せる', () => {
    const view = buildMacroView({
      observations: { 'etf-gld': { '2026-08-14': 401.48 } },
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(view.find((p) => p.date === '2026-08-14')?.gold).toBe(401.48);
  });
});

describe('下落率のビュー (#128)', () => {
  const definitions = [{ id: 'etf-x', group: 'major' }];
  const names = { 'etf-x': 'テスト資産' };
  const build = (observations: ObservationMap, seed: Parameters<typeof buildDrawdownView>[0]['seed']) =>
    buildDrawdownView({
      observations,
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 22)),
      seed,
      assets: definitions,
      names,
    });

  it('引き継いだ履歴と観測から計算した分が繋がる', () => {
    // 履歴には価格が無いので、繋ぎ目は引き継いだ最高値で揃える。
    const view = build(
      { 'etf-x': { '2026-08-21': 90 } },
      { assets: { 'etf-x': { seedHigh: 100, drawdown: { '2026-08-14': 5 } } } },
    );
    const points = view.assets[0].points;
    expect(points.find((p) => p.date === '2026-08-14')?.drawdown).toBe(5);
    // 最高値 100 に対し 90 なので 10%。履歴の 5% から連続している。
    expect(points.find((p) => p.date === '2026-08-21')?.drawdown).toBeCloseTo(10, 10);
  });

  it('観測が最高値を更新したら以降の基準が変わる', () => {
    // **最高値は導出値**。観測から積み上げるので、異常な観測を消せば直せる。
    const view = build(
      { 'etf-x': { '2026-08-14': 200, '2026-08-21': 150 } },
      { assets: { 'etf-x': { seedHigh: 100, drawdown: {} } } },
    );
    const points = view.assets[0].points;
    expect(points.find((p) => p.date === '2026-08-14')?.drawdown).toBe(0);
    // 新しい最高値 200 に対し 150 なので 25%。引き継いだ 100 は使わない。
    expect(points.find((p) => p.date === '2026-08-21')?.drawdown).toBeCloseTo(25, 10);
    expect(view.assets[0].high).toBe(200);
  });

  it('履歴も観測も無い資産は除外して理由を残す', () => {
    // 黙って消すと、画面から資産が減ったことに気付けない。
    const view = build({}, { assets: {} });
    expect(view.assets).toHaveLength(0);
    expect(view.excluded).toEqual([{ id: 'etf-x', reason: '履歴も観測も無い' }]);
  });

  it('引き継いだ履歴の開始日を起点にする (#166)', () => {
    // 週次グリッド (2016 起点) では 524 点中 89 点しか値が無く、
    // データが存在しない期間を運んでいた。起点を seed に合わせると無駄が消える。
    const view = build(
      { 'etf-x': { '2026-08-20': 90 } },
      { assets: { 'etf-x': { seedHigh: 100, drawdown: { '2026-08-14': 5 } } } },
    );
    expect(view.assets[0].points[0].date).toBe('2026-08-14');
  });

  it('平日を並べる (#166)', () => {
    // 観測は毎日入る (#136)。週次グリッドは金曜だけを拾うため週内の動きが消えていた。
    const view = build(
      { 'etf-x': { '2026-08-19': 90 } },
      { assets: { 'etf-x': { seedHigh: 100, drawdown: { '2026-08-17': 5 } } } },
    );
    expect(view.assets[0].points.map((p) => p.date)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ]);
  });

  it('最高値の起点を持つ', () => {
    // 史上最高値ではないことを画面に出すために要る。
    const view = build({}, { assets: { 'etf-x': { seedHigh: 100, drawdown: { '2026-08-14': 5 } } } });
    expect(view.seedStart).toBe('2026-08-14');
  });

  describe('最高値をグリッドの外の観測からも取る (#138)', () => {
    it('週の途中で付けた高値を取りこぼさない', () => {
      // 日次バッチ (#136) では観測が毎営業日入る。金曜だけを見ると
      // 水曜に付けた 200 を見落とし、最高値 150 で下落率を出してしまう。
      const view = build(
        {
          'etf-x': {
            '2026-08-14': 150,
            '2026-08-19': 200, // 水曜。グリッド (金曜) には無い日
            '2026-08-21': 160,
          },
        },
        { assets: { 'etf-x': { seedHigh: 100, drawdown: {} } } },
      );
      const points = view.assets[0].points;
      // 最高値 200 に対し 160 なので 20%。水曜を見落とすと 150 基準で 0% になる。
      expect(points.find((p) => p.date === '2026-08-21')?.drawdown).toBeCloseTo(20, 10);
      expect(view.assets[0].high).toBe(200);
    });

    it('過去の点は当時の最高値で出す', () => {
      // 後から付いた高値を過去に遡って適用すると、当時の下落率が実際より深く見える。
      const view = build(
        { 'etf-x': { '2026-08-14': 150, '2026-08-21': 200 } },
        { assets: { 'etf-x': { seedHigh: 100, drawdown: {} } } },
      );
      const points = view.assets[0].points;
      // 08-14 時点の最高値は 150 (まだ 200 は観測されていない) なので 0%。
      expect(points.find((p) => p.date === '2026-08-14')?.drawdown).toBe(0);
      expect(points.find((p) => p.date === '2026-08-21')?.drawdown).toBe(0);
    });

    it('引き継いだ最高値が観測開始より前なら、そのまま起点にする (#149)', () => {
      // 最高値を付けたのが観測より前なら、その時点で既に最高値だったので遡及にならない。
      // seed に下落率 0 の日が無い = 観測開始より前に最高値を付けている。
      const view = build(
        { 'etf-x': { '2026-08-14': 90, '2026-08-21': 80 } },
        { assets: { 'etf-x': { seedHigh: 100, drawdown: { '2026-08-14': 10 } } } },
      );
      expect(view.assets[0].high).toBe(100);
      expect(view.assets[0].points.find((p) => p.date === '2026-08-14')?.drawdown).toBeCloseTo(10, 10);
    });

    it('観測期間の中で最高値を更新していたら遡及させない (#149)', () => {
      // seed が 08-21 に下落率 0 を記録している = その日に最高値を付けた。
      // 08-14 の点を 08-21 の高値で割ると、当時より深い下落率に見える。
      const view = build(
        { 'etf-x': { '2026-08-14': 90, '2026-08-21': 120 } },
        { assets: { 'etf-x': { seedHigh: 120, drawdown: { '2026-08-14': 10, '2026-08-21': 0 } } } },
      );
      const points = view.assets[0].points;
      // 08-14 当時の最高値は 90 ÷ (1 − 0.10) = 100。120 で割ると 25% になってしまう。
      expect(points.find((p) => p.date === '2026-08-14')?.drawdown).toBeCloseTo(10, 10);
      // 08-21 に 120 を観測して最高値が更新される。
      expect(points.find((p) => p.date === '2026-08-21')?.drawdown).toBe(0);
      expect(view.assets[0].high).toBe(120);
    });

    it('グリッド最終点より後の観測も最高値に含める', () => {
      // #125 の状況。平日に取れた値がその週の金曜より後になることがある。
      // 最高値として嘘をつかないため、表示する最高値には含める。
      const view = build(
        { 'etf-x': { '2026-08-21': 150, '2026-08-25': 300 } },
        { assets: { 'etf-x': { seedHigh: 100, drawdown: {} } } },
      );
      expect(view.assets[0].high).toBe(300);
      // ただし各点の下落率はその時点までの最高値で出す (08-21 は 150 が最高値)。
      expect(view.assets[0].points.find((p) => p.date === '2026-08-21')?.drawdown).toBe(0);
    });
  });
});

describe('SPY に対する相対強度 (#274)', () => {
  const definitions = [
    { id: 'etf-x', group: 'major' },
    { id: 'etf-spy', group: 'major' },
  ];
  const names = { 'etf-x': 'テスト資産', 'etf-spy': 'SPY' };
  const build = (observations: ObservationMap) =>
    buildDrawdownView({
      observations,
      config,
      start: '2026-08-01',
      today: new Date(Date.UTC(2026, 7, 22)),
      seed: { assets: {} },
      assets: definitions,
      names,
    });

  it('最初の共通観測日を基準に、その後の比率変化を % で示す', () => {
    const view = build({
      'etf-x': { '2026-08-14': 100, '2026-08-21': 110 }, // +10%
      'etf-spy': { '2026-08-14': 500, '2026-08-21': 505 }, // +1%
    });
    const asset = view.assets.find((a) => a.id === 'etf-x');
    const point = asset?.relativeStrengthPoints.find((p) => p.date === '2026-08-21');
    // (1.10 / 1.01 − 1) × 100 ≈ +8.91
    expect(point?.value).toBeCloseTo(8.91, 1);
    expect(asset?.latestRelativeStrength?.value).toBeCloseTo(8.91, 1);
  });

  it('SPY 自身は基準そのものと比べるため恒等的にゼロになる', () => {
    const view = build({
      'etf-spy': { '2026-08-14': 500, '2026-08-21': 505 },
    });
    const spy = view.assets.find((a) => a.id === 'etf-spy');
    const values = spy?.relativeStrengthPoints
      .filter((p) => p.value !== null)
      .map((p) => p.value);
    expect(values?.length).toBeGreaterThan(0);
    expect(values?.every((value) => value === 0)).toBe(true);
    expect(spy?.latestRelativeStrength?.value).toBe(0);
  });

  it('SPY の観測が無い期間は null (誤解を招く数値を出さない)', () => {
    const view = build({ 'etf-x': { '2026-08-21': 100 } });
    const asset = view.assets.find((a) => a.id === 'etf-x');
    expect(asset?.relativeStrengthPoints.every((p) => p.value === null)).toBe(true);
    expect(asset?.latestRelativeStrength).toBeNull();
  });

  it('起点は全資産が値を持つ最も遅い日 (#289)', () => {
    // etf-spy は 08-14 から値があるが、etf-x は 08-17 から。
    // 08-14 を起点にすると「etf-x もこの日から値がある」と過大に見せてしまう。
    const view = build({
      'etf-spy': { '2026-08-14': 500, '2026-08-17': 505, '2026-08-21': 510 },
      'etf-x': { '2026-08-17': 100, '2026-08-21': 110 },
    });
    expect(view.relativeStrengthStart).toBe('2026-08-17');
  });

  it('どの資産にも値が無ければ起点は null', () => {
    const view = build({});
    expect(view.relativeStrengthStart).toBeNull();
  });
});

describe('価格系列の日次グリッド (#137)', () => {
  // ページ別に分けたので (#168)、系列が属するビューを指定して作る。
  const build = (observations: ObservationMap, view: 'market' | 'economy' | 'japan' = 'market') =>
    buildDailyView(
      { observations, config, start: '2026-08-10', today: new Date(Date.UTC(2026, 7, 21)) },
      view,
    );

  it('平日だけを並べる', () => {
    // 土日は市場が閉じており、valueAsOf が金曜の値を繰り返すだけで情報が増えない。
    const dates = build({}).map((p) => p.date);
    expect(dates).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ]);
  });

  it('週の途中の動きが図に出る', () => {
    // 週次グリッドは金曜の値だけを拾うため、水曜の 20.1 がそもそも図に無かった。
    const view = build({ vix: { '2026-08-12': 20.1, '2026-08-14': 15.0 } });
    expect(view.find((p) => p.date === '2026-08-12')?.vix).toBe(20.1);
    expect(view.find((p) => p.date === '2026-08-14')?.vix).toBe(15.0);
  });

  it('観測が無い日は直近の営業日まで遡る', () => {
    // 祝日は考慮していない。取引所が休みだった日は直前の値が入る。
    const view = build({ nikkei225: { '2026-08-11': 42000 } }, 'japan');
    expect(view.find((p) => p.date === '2026-08-13')?.nikkei225).toBe(42000);
    // 観測より前の日は埋めない。
    expect(view.find((p) => p.date === '2026-08-10')?.nikkei225).toBeNull();
  });

  it('ゴールドを日次で載せる (#135)', () => {
    // 履歴ページから 50 営業日ぶんを遡って取り込んだので、週次より細かく描ける。
    const view = build({ 'etf-gld': { '2026-08-13': 398.96, '2026-08-14': 401.48 } }, 'market');
    expect(view.find((p) => p.date === '2026-08-13')?.gold).toBe(398.96);
    expect(view.find((p) => p.date === '2026-08-14')?.gold).toBe(401.48);
  });

  it('実質金利を名目と期待インフレ率から出す', () => {
    // マクロビューと同じ導出。定義がずれると 2 つの図で違う値が出る。
    const view = build({ dgs10: { '2026-08-14': 4.69 }, t10yie: { '2026-08-14': 2.24 } });
    const point = view.find((p) => p.date === '2026-08-14');
    expect(point?.realRate).toBeCloseTo(2.45, 10);
  });
});
