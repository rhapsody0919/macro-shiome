import { describe, expect, it } from 'vitest';
import { detectHighlights, detectWarnings } from './signals';
import type { BreakoutAsset, DrawdownAsset, MacroPoint } from '../data/types';

function macroPoint(date: string, overrides: Partial<MacroPoint> = {}): MacroPoint {
  return {
    date,
    vix: null,
    usdjpy: null,
    nominalRate: null,
    breakeven: null,
    realRate: null,
    potentialGrowth: null,
    treasuryFairValue: null,
    termSpread: null,
    mortgageRate: null,
    initialClaims: null,
    creditConditions: null,
    hySpread: null,
    igSpread: null,
    fedFundsRate: null,
    wti: null,
    dollarIndex: null,
    gold: null,
    nikkei225: null,
    newJobPostings: null,
    nfci: null,
    anfci: null,
    financialStress: null,
    twoYearRate: null,
    sofr: null,
    breakeven5y: null,
    breakeven5y5y: null,
    continuedClaims: null,
    fedBalanceSheet: null,
    termSpread3m: null,
    tbill3m: null,
    nasdaqComposite: null,
    djia: null,
    usdEur: null,
    cnyUsd: null,
    federalDebtPublic: null,
    ...overrides,
  };
}

const today = new Date(Date.UTC(2026, 7, 22));

describe('detectWarnings (#279)', () => {
  it('逆イールド (termSpread<0) をゼロ基準で検出する', () => {
    const macro = [macroPoint('2026-08-21', { termSpread: -0.1 })];
    const warnings = detectWarnings(macro, today);
    const warning = warnings.find((w) => w.id === 'inverted-yield-curve');
    expect(warning).toBeDefined();
    expect(warning?.basis).toBe('zero-line');
    expect(warning?.percentile).toBeNull();
    expect(warning?.value).toBe(-0.1);
  });

  it('順イールド (termSpread>=0) なら検出しない', () => {
    const macro = [macroPoint('2026-08-21', { termSpread: 0.5 })];
    expect(detectWarnings(macro, today).find((w) => w.id === 'inverted-yield-curve')).toBeUndefined();
  });

  it('NFCIが正 (引き締まり) をゼロ基準で検出する', () => {
    const macro = [macroPoint('2026-08-21', { nfci: 0.2 })];
    const warning = detectWarnings(macro, today).find((w) => w.id === 'tight-financial-conditions');
    expect(warning).toBeDefined();
    expect(warning?.basis).toBe('zero-line');
  });

  it('VIXが過去5年で上位10%ならパーセンタイル基準で検出する', () => {
    // 直近 (i=59) が最大値になるよう単調増加させる (percentileRank が高くなる)。
    // 週次で60点、直近が今日 (2026-08-21 起点で1週ずつ遡る)。
    const macro = Array.from({ length: 60 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 7, 21 - (59 - i) * 7)).toISOString().slice(0, 10);
      return macroPoint(date, { vix: 10 + i });
    });
    const warning = detectWarnings(macro, today).find((w) => w.id === 'vix-spike');
    expect(warning).toBeDefined();
    expect(warning?.basis).toBe('percentile');
    expect(warning?.percentile).toBeGreaterThanOrEqual(90);
  });

  it('標本不足ならパーセンタイル基準の警告を出さない', () => {
    const macro = [macroPoint('2026-08-21', { vix: 40 })];
    expect(detectWarnings(macro, today).find((w) => w.id === 'vix-spike')).toBeUndefined();
  });

  it('note は生成しない (null のまま)', () => {
    const macro = [macroPoint('2026-08-21', { termSpread: -0.1 })];
    const warning = detectWarnings(macro, today).find((w) => w.id === 'inverted-yield-curve');
    expect(warning?.note).toBeNull();
  });
});

function drawdownAsset(
  id: string,
  overrides: Partial<DrawdownAsset> = {},
): DrawdownAsset {
  return {
    id,
    name: id,
    group: 'sector',
    high: 100,
    latest: { date: '2026-08-21', drawdown: 10 },
    points: [],
    latestRelativeStrength: null,
    relativeStrengthPoints: [],
    ...overrides,
  };
}

function breakoutAsset(symbol: string, detected: boolean): BreakoutAsset {
  return {
    symbol,
    name: symbol,
    detection: detected
      ? {
          firstLowDate: '2026-07-01',
          firstLowPrice: 90,
          priorHighDate: '2026-07-10',
          priorHighPrice: 100,
          secondLowDate: '2026-07-15',
          secondLowPrice: 80,
          breakoutDate: '2026-08-01',
          breakoutPrice: 101,
          swingLength: 50,
        }
      : null,
    priceSeries: null,
  };
}

describe('detectHighlights (#279)', () => {
  const symbolOf = (id: string) => (id === 'etf-vgt' ? 'VGT' : id === 'etf-vcr' ? 'VCR' : null);

  it('2つ以上のシグナルが重なった資産だけを対象にする', () => {
    // vgt: 深い下落率(上位1/3) + 相対強度プラス → 2シグナル。
    const assets = [
      drawdownAsset('etf-vgt', {
        latest: { date: '2026-08-21', drawdown: 30 },
        latestRelativeStrength: { date: '2026-08-21', value: 5 },
      }),
      drawdownAsset('etf-vcr', {
        latest: { date: '2026-08-21', drawdown: 2 },
        latestRelativeStrength: { date: '2026-08-21', value: -5 },
      }),
    ];
    const highlights = detectHighlights(assets, [breakoutAsset('VGT', false)], symbolOf);
    expect(highlights.map((h) => h.id)).toEqual(['etf-vgt']);
    expect(highlights[0]?.signalCount).toBe(2);
  });

  it('単一シグナルだけの資産は対象にしない (ただ安いだけを除外する)', () => {
    // 深い下落率だけで、相対強度はマイナス・ブレイクアウトも無い。
    const assets = [
      drawdownAsset('etf-vgt', {
        latest: { date: '2026-08-21', drawdown: 30 },
        latestRelativeStrength: { date: '2026-08-21', value: -5 },
      }),
    ];
    expect(detectHighlights(assets, [], symbolOf)).toEqual([]);
  });

  it('ブレイクアウト検出込みで3シグナル揃えばsignalCount=3になる', () => {
    const assets = [
      drawdownAsset('etf-vgt', {
        latest: { date: '2026-08-21', drawdown: 30 },
        latestRelativeStrength: { date: '2026-08-21', value: 5 },
      }),
    ];
    const highlights = detectHighlights(assets, [breakoutAsset('VGT', true)], symbolOf);
    expect(highlights[0]?.signalCount).toBe(3);
    expect(highlights[0]?.hasBreakout).toBe(true);
  });

  it('最新値が無い資産は対象にしない', () => {
    const assets = [drawdownAsset('etf-vgt', { latest: null })];
    expect(detectHighlights(assets, [], symbolOf)).toEqual([]);
  });

  it('note は生成しない (null のまま)', () => {
    const assets = [
      drawdownAsset('etf-vgt', {
        latest: { date: '2026-08-21', drawdown: 30 },
        latestRelativeStrength: { date: '2026-08-21', value: 5 },
      }),
    ];
    const highlights = detectHighlights(assets, [], symbolOf);
    expect(highlights[0]?.note).toBeNull();
  });
});
