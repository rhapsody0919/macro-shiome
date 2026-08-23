/**
 * BOS (#272) の priceSeries のビュー生成テスト。
 *
 * 検出ロジック自体は `bos.test.ts` で検証済み、`priceSeries` の切り出しロジックは
 * `view.breakout.test.ts` (CHoCH) で検証済みのため、ここでは `buildBosView` が
 * `detectBos` と `slicePriceSeriesForChart` を正しく組み合わせているかだけを見る。
 */
import { describe, expect, it } from 'vitest';
import { buildBosView } from './view';
import type { OhlcvBar } from '../data/types';

function bar(partial: Partial<OhlcvBar> & { high: number; low: number }): OhlcvBar {
  return {
    open: partial.open ?? partial.low,
    high: partial.high,
    low: partial.low,
    close: partial.close ?? partial.high,
    volume: partial.volume ?? 1000,
  };
}

function toObservations(
  entries: Array<{ date: string } & Parameters<typeof bar>[0]>,
): Record<string, OhlcvBar> {
  return Object.fromEntries(entries.map(({ date, ...rest }) => [date, bar(rest)]));
}

function d(offset: number): string {
  const date = new Date('2026-01-01T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function wave(
  waypoints: Array<{ index: number; low: number }>,
): Array<{ date: string; low: number; high: number }> {
  const lows = new Map<number, number>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]!;
    const end = waypoints[i + 1]!;
    const steps = end.index - start.index;
    for (let s = 0; s <= steps; s++) {
      const idx = start.index + s;
      if (lows.has(idx)) continue;
      lows.set(idx, start.low + ((end.low - start.low) * s) / steps);
    }
  }
  const maxIndex = Math.max(...waypoints.map((w) => w.index));
  const entries: Array<{ date: string; low: number; high: number }> = [];
  for (let idx = 0; idx <= maxIndex; idx++) {
    const low = lows.get(idx);
    if (low === undefined) throw new Error(`waypoint の間隔が不正: index ${idx} が埋まらない`);
    entries.push({ date: d(idx), low, high: low + 5 });
  }
  return entries;
}

const generatedAt = '2026-08-23T02:00:00.000Z';
const symbols = [{ symbol: 'TEST', name: 'テスト銘柄' }];

// L1 (index6) → H1 (index13) → L2 (index20、L1より高い = 安値切り上げ) → 回復 (index30)。
const TYPICAL_WAYPOINTS = [
  { index: 0, low: 65 },
  { index: 6, low: 40 },
  { index: 13, low: 70 },
  { index: 20, low: 50 },
  { index: 30, low: 78 },
];

describe('BOS の priceSeries (#272)', () => {
  it('観測本数がCHART_DISPLAY_MIN_DAYS以下なら全期間を切り出す', () => {
    const view = buildBosView({
      symbols,
      ohlcvObservations: { TEST: toObservations(wave(TYPICAL_WAYPOINTS)) },
      generatedAt,
      swingLength: 3,
    });
    const asset = view.assets[0]!;
    expect(asset.detection).not.toBeNull();
    expect(asset.detection!.firstLowDate).toBe(d(6));
    expect(asset.detection!.secondLowPrice).toBeGreaterThan(asset.detection!.firstLowPrice);
    expect(asset.priceSeries).not.toBeNull();
    expect(asset.priceSeries![0]!.date).toBe(d(0));
    expect(asset.priceSeries!.at(-1)!.date).toBe(d(30));
  });

  it('検出されなければ priceSeries も null', () => {
    const undetected = TYPICAL_WAYPOINTS.map((w) => (w.index === 30 ? { ...w, low: 60 } : w));
    const view = buildBosView({
      symbols,
      ohlcvObservations: { TEST: toObservations(wave(undetected)) },
      generatedAt,
      swingLength: 3,
    });
    expect(view.assets[0]!.detection).toBeNull();
    expect(view.assets[0]!.priceSeries).toBeNull();
  });
});
