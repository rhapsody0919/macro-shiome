import { describe, expect, it } from 'vitest';
import {
  buildSummaryView,
  latestMacroFacts,
  sanitizeNote,
  summarizeEconomyState,
  summarizeHighlights,
  summarizeWarnings,
  type Summarizer,
} from './summary';
import type { MacroPoint, SectorHighlight, WarningSignal } from '../data/types';

describe('sanitizeNote (#279)', () => {
  it('数値・評価語・マークダウン・開発メモが無ければそのまま返す', () => {
    expect(sanitizeNote('  長短金利が逆転しており、景気後退の先行指標とされる状態にある。  ')).toBe(
      '長短金利が逆転しており、景気後退の先行指標とされる状態にある。',
    );
  });

  it('数値を含む応答は捨てる', () => {
    expect(sanitizeNote('スプレッドは2.5%まで拡大している')).toBeNull();
  });

  it('評価語を含む応答は捨てる', () => {
    expect(sanitizeNote('いま買い時である')).toBeNull();
  });

  it('マークダウンの装飾を含む応答は捨てる', () => {
    expect(sanitizeNote('**重要な指標**である')).toBeNull();
  });

  it('開発メモ (Issue番号・コード識別子) を含む応答は捨てる', () => {
    expect(sanitizeNote('#279 で追加した指標')).toBeNull();
    expect(sanitizeNote('`termSpread` を見る')).toBeNull();
  });

  it('空文字は捨てる', () => {
    expect(sanitizeNote('   ')).toBeNull();
  });
});

function warning(overrides: Partial<WarningSignal> = {}): WarningSignal {
  return {
    id: 'inverted-yield-curve',
    label: '逆イールド',
    value: -0.1,
    basis: 'zero-line',
    percentile: null,
    date: '2026-08-21',
    note: null,
    ...overrides,
  };
}

describe('summarizeWarnings (#279)', () => {
  it('LLMの応答をidごとに割り当てる', async () => {
    const summarizer: Summarizer = {
      summarize: async () => 'id=inverted-yield-curve: 短期金利が長期金利を上回っている状態。',
    };
    const result = await summarizeWarnings(summarizer, [warning()]);
    expect(result[0]?.note).toBe('短期金利が長期金利を上回っている状態。');
  });

  it('ガードレールに違反する応答はnoteをnullのままにする', async () => {
    const summarizer: Summarizer = { summarize: async () => 'id=inverted-yield-curve: 危険な水準。' };
    const result = await summarizeWarnings(summarizer, [warning()]);
    expect(result[0]?.note).toBeNull();
  });

  it('LLM呼び出しが失敗しても他のフィールドはそのまま返す (バッチ全体を落とさない)', async () => {
    const summarizer: Summarizer = {
      summarize: async () => {
        throw new Error('network error');
      },
    };
    const result = await summarizeWarnings(summarizer, [warning()]);
    expect(result[0]?.note).toBeNull();
    expect(result[0]?.id).toBe('inverted-yield-curve');
  });

  it('空配列ならLLMを呼ばない', async () => {
    let called = false;
    const summarizer: Summarizer = {
      summarize: async () => {
        called = true;
        return '';
      },
    };
    await summarizeWarnings(summarizer, []);
    expect(called).toBe(false);
  });
});

function highlight(overrides: Partial<SectorHighlight> = {}): SectorHighlight {
  return {
    id: 'etf-vgt',
    name: '情報技術セクター',
    drawdown: 25,
    relativeStrength: 5,
    hasBreakout: false,
    signalCount: 2,
    note: null,
    ...overrides,
  };
}

describe('summarizeHighlights (#279)', () => {
  it('LLMの応答をidごとに割り当てる', async () => {
    const summarizer: Summarizer = {
      summarize: async () => 'id=etf-vgt: 市場全体の下げに対して相対的に底堅い動きをしている。',
    };
    const result = await summarizeHighlights(summarizer, [highlight()]);
    expect(result[0]?.note).toBe('市場全体の下げに対して相対的に底堅い動きをしている。');
  });

  it('該当する行が無ければnoteはnullのまま', async () => {
    const summarizer: Summarizer = { summarize: async () => 'id=other-symbol: 説明。' };
    const result = await summarizeHighlights(summarizer, [highlight()]);
    expect(result[0]?.note).toBeNull();
  });
});

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

describe('latestMacroFacts (#279)', () => {
  it('直近の値が無いフィールドは除く', () => {
    const facts = latestMacroFacts([macroPoint('2026-08-21', { termSpread: 0.5, vix: null })]);
    expect(facts.find((f) => f.label.includes('VIX'))).toBeUndefined();
    expect(facts.find((f) => f.label.includes('イールドカーブ'))?.value).toBe(0.5);
  });

  it('データが無ければ空配列', () => {
    expect(latestMacroFacts([])).toEqual([]);
  });
});

describe('summarizeEconomyState (#279)', () => {
  it('材料が無ければLLMを呼ばずnull', async () => {
    let called = false;
    const summarizer: Summarizer = {
      summarize: async () => {
        called = true;
        return '経済は安定している。';
      },
    };
    expect(await summarizeEconomyState(summarizer, [])).toBeNull();
    expect(called).toBe(false);
  });

  it('ガードレールを通れば要約文を返す', async () => {
    const summarizer: Summarizer = { summarize: async () => '景気は緩やかに減速している。' };
    const result = await summarizeEconomyState(summarizer, [{ label: 'VIX', value: 20 }]);
    expect(result).toBe('景気は緩やかに減速している。');
  });
});

describe('buildSummaryView (#279)', () => {
  it('3種類の生成をまとめてSummaryViewにする', async () => {
    const summarizer: Summarizer = {
      summarize: async (prompt) => {
        if (prompt.includes('id=inverted-yield-curve')) {
          return 'id=inverted-yield-curve: 短期金利が長期金利を上回っている。';
        }
        if (prompt.includes('id=etf-vgt')) {
          return 'id=etf-vgt: 相対的に底堅い。';
        }
        return '景気は緩やかに減速している。';
      },
    };
    const view = await buildSummaryView(
      summarizer,
      {
        macro: [macroPoint('2026-08-21', { termSpread: -0.1 })],
        warnings: [warning()],
        highlights: [highlight()],
      },
      '2026-08-23T02:00:00.000Z',
    );
    expect(view.generatedAt).toBe('2026-08-23T02:00:00.000Z');
    expect(view.economyState).toBe('景気は緩やかに減速している。');
    // macro には termSpread しか値が無いため、材料は1件。
    expect(view.economyStateFactCount).toBe(1);
    expect(view.warnings[0]?.note).toBe('短期金利が長期金利を上回っている。');
    expect(view.highlights[0]?.note).toBe('相対的に底堅い。');
  });

  it('経済状態が生成できなければ材料件数も0にする (#283)', async () => {
    // ガードレール違反で economyState が null になるケース。
    const summarizer: Summarizer = { summarize: async () => 'いま買い時である' };
    const view = await buildSummaryView(
      summarizer,
      { macro: [macroPoint('2026-08-21', { termSpread: -0.1 })], warnings: [], highlights: [] },
      '2026-08-23T02:00:00.000Z',
    );
    expect(view.economyState).toBeNull();
    expect(view.economyStateFactCount).toBe(0);
  });
});
