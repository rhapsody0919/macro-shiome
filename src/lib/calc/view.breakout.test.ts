/**
 * ブレイクアウト (CHoCH、#268) の priceSeries のビュー生成テスト。
 *
 * 検出ロジック自体は `choch.test.ts` で検証済みなので、ここでは `buildBreakoutView` が
 * 検出結果から正しい区間 (CHoCH の構造全体と直近90営業日のうち広い方) の終値系列を
 * 切り出せているか、検出できない場合は `priceSeries` も `null` になるかを見る。
 */
import { describe, expect, it } from 'vitest';
import { buildBreakoutView } from './view';
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

// L1 (index6) → H1 (index13) → L2 (index20) → 回復 (index30、H1を上抜ける)。
// 全体で30本しか無いため、CHART_DISPLAY_MIN_DAYS (90) には満たない。
const TYPICAL_WAYPOINTS = [
  { index: 0, low: 65 },
  { index: 6, low: 50 },
  { index: 13, low: 70 },
  { index: 20, low: 30 },
  { index: 30, low: 78 },
];

// TYPICAL_WAYPOINTS と同じ形だが間隔を広げ、firstLowDate (index30) から基準日
// (index150) までの間隔を CHART_DISPLAY_MIN_DAYS (90) より大きくする。
const STRETCHED_WAYPOINTS = [
  { index: 0, low: 65 },
  { index: 30, low: 50 },
  { index: 65, low: 70 },
  { index: 100, low: 30 },
  { index: 150, low: 78 },
];

describe('ブレイクアウト (CHoCH) の priceSeries (#268)', () => {
  it('観測本数がCHART_DISPLAY_MIN_DAYS以下なら全期間を切り出す (構造の起点より前も含む)', () => {
    const view = buildBreakoutView({
      symbols,
      ohlcvObservations: { TEST: toObservations(wave(TYPICAL_WAYPOINTS)) },
      generatedAt,
      swingLength: 3,
    });
    const asset = view.assets[0]!;
    expect(asset.detection).not.toBeNull();
    expect(asset.detection!.firstLowDate).toBe(d(6));
    expect(asset.priceSeries).not.toBeNull();
    // 90本に満たないため、bars全体 (index0〜30、31本) がそのまま入る。
    expect(asset.priceSeries).toHaveLength(31);
    expect(asset.priceSeries![0]!.date).toBe(d(0));
    expect(asset.priceSeries!.at(-1)!.date).toBe(d(30));
  });

  it('構造の起点 (firstLowDate) が直近90営業日より前なら、そこまで遡って含める', () => {
    const view = buildBreakoutView({
      symbols,
      ohlcvObservations: { TEST: toObservations(wave(STRETCHED_WAYPOINTS)) },
      generatedAt,
      swingLength: 3,
    });
    const asset = view.assets[0]!;
    expect(asset.detection).not.toBeNull();
    expect(asset.priceSeries).not.toBeNull();
    // firstLowDate (index30) は基準日 (index150) から120本前で、90本の境界より前。
    // 構造全体が入るよう、90本の境界ではなく firstLowDate まで遡っている。
    expect(asset.priceSeries![0]!.date).toBe(asset.detection!.firstLowDate);
    expect(asset.priceSeries!.at(-1)!.date).toBe(d(150));
  });

  it('検出されなければ priceSeries も null', () => {
    const undetected = TYPICAL_WAYPOINTS.map((w) => (w.index === 30 ? { ...w, low: 60 } : w));
    const view = buildBreakoutView({
      symbols,
      ohlcvObservations: { TEST: toObservations(wave(undetected)) },
      generatedAt,
      swingLength: 3,
    });
    expect(view.assets[0]!.detection).toBeNull();
    expect(view.assets[0]!.priceSeries).toBeNull();
  });
});
