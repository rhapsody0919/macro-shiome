import { describe, expect, it, vi } from 'vitest';
import { FredClient } from '../adapters/fred';
import type { IndicatorMaster } from '../data/types';
import { buildReleaseCalendar } from './release-calendar';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** 指標マスタのエントリを最小限で作る。テストに要らないフィールドは省く。 */
function fredIndicator(seriesId: string) {
  return {
    name: seriesId,
    source: { adapter: 'fred', seriesId } as const,
    frequency: 'monthly',
    unit: 'index',
    attribution: 'test',
    copyright: 'none',
    group: 'macro',
  } as IndicatorMaster[string];
}

function factsetIndicator() {
  return {
    name: 'test',
    source: { adapter: 'factset-pdf', field: 'forwardPe' } as const,
    frequency: 'weekly',
    unit: 'ratio',
    attribution: 'test',
    copyright: 'restricted',
    group: 'valuation',
  } as IndicatorMaster[string];
}

describe('buildReleaseCalendar (#270)', () => {
  it('同じリリースに属する FRED 指標をまとめる', async () => {
    // cpi と cpi-core は同じ「Consumer Price Index」リリースに属する状況を模す。
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/series/release')) {
        return Promise.resolve(
          jsonResponse({ releases: [{ id: 10, name: 'Consumer Price Index' }] }),
        );
      }
      if (url.includes('/release/dates')) {
        return Promise.resolve(
          jsonResponse({ release_dates: [{ release_id: 10, date: '2026-09-11' }] }),
        );
      }
      throw new Error(`想定外の URL: ${url}`);
    });
    const fred = new FredClient({
      apiKey: 'test-key',
      fetchImpl,
      sleep: async () => {},
      intervalMs: 0,
    });

    const indicators: IndicatorMaster = {
      cpi: fredIndicator('CPIAUCSL'),
      'cpi-core': fredIndicator('CPILFESL'),
    };

    const view = await buildReleaseCalendar({
      indicators,
      fred,
      now: new Date(Date.UTC(2026, 7, 24)),
    });

    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]).toEqual({
      label: 'Consumer Price Index',
      indicatorIds: ['cpi', 'cpi-core'],
      nextReleaseDate: '2026-09-11',
      source: 'fred',
    });
  });

  it('リリース取得に失敗した指標は onError で報告し、他は続行する', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('CPIAUCSL')) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      if (url.includes('/series/release')) {
        return Promise.resolve(jsonResponse({ releases: [{ id: 20, name: 'GDP' }] }));
      }
      return Promise.resolve(jsonResponse({ release_dates: [{ release_id: 20, date: '2026-09-30' }] }));
    });
    const fred = new FredClient({
      apiKey: 'test-key',
      fetchImpl,
      sleep: async () => {},
      intervalMs: 0,
      maxRetries: 0,
    });

    const indicators: IndicatorMaster = {
      cpi: fredIndicator('CPIAUCSL'),
      gdp: fredIndicator('GDPC1'),
    };
    const errors: string[] = [];

    const view = await buildReleaseCalendar({
      indicators,
      fred,
      now: new Date(Date.UTC(2026, 7, 24)),
      onError: (msg) => errors.push(msg),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('cpi');
    expect(view.entries).toEqual([
      { label: 'GDP', indicatorIds: ['gdp'], nextReleaseDate: '2026-09-30', source: 'fred' },
    ]);
  });

  it('FactSet 由来の指標は 1 件のエントリにまとめる', async () => {
    const fred = new FredClient({
      apiKey: 'test-key',
      fetchImpl: vi.fn(),
      sleep: async () => {},
      intervalMs: 0,
    });
    const indicators: IndicatorMaster = {
      'sp500-forward-pe': factsetIndicator(),
      'sp500-trailing-pe': factsetIndicator(),
    };

    const view = await buildReleaseCalendar({
      indicators,
      fred,
      now: new Date(Date.UTC(2026, 7, 21)),
      // 実ネットワークを避ける。resolveFactsetNextIssueDate 自体のロジックは
      // factset.test.ts で個別に検証済み。
      resolveFactsetDate: async () => '2026-08-28',
    });

    const factsetEntry = view.entries.find((e) => e.source === 'factset');
    expect(factsetEntry).toEqual({
      label: 'S&P 500 Earnings Insight (FactSet)',
      indicatorIds: expect.arrayContaining(['sp500-forward-pe', 'sp500-trailing-pe']),
      nextReleaseDate: '2026-08-28',
      source: 'factset',
    });
  });

  it('FRED・FactSet どちらも無ければ空の一覧を返す', async () => {
    const fred = new FredClient({ apiKey: 'test-key', fetchImpl: vi.fn(), sleep: async () => {} });
    const view = await buildReleaseCalendar({ indicators: {}, fred, now: new Date(Date.UTC(2026, 7, 24)) });
    expect(view.entries).toEqual([]);
  });
});
