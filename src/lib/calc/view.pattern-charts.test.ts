/**
 * パターンチャート用の `priceSeries` (#260) のビュー生成テスト。
 *
 * 各パターンの検出ロジック自体は `cup-with-handle.test.ts` / `double-bottom.test.ts` /
 * `head-and-shoulders-bottom.test.ts` で検証済みなので、ここでは
 * `buildCupWithHandleView` / `buildDoubleBottomView` / `buildHeadAndShouldersBottomView` が
 * 検出結果から正しい区間 (パターンの起点〜基準日) の終値系列を切り出しているかだけを見る。
 */
import { describe, expect, it } from 'vitest';
import {
  buildCupWithHandleView,
  buildDoubleBottomView,
  buildHeadAndShouldersBottomView,
} from './view';
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

const generatedAt = '2026-08-23T02:00:00.000Z';
const symbols = [{ symbol: 'TEST', name: 'テスト銘柄' }];

describe('カップウィズハンドルの priceSeries (#260)', () => {
  // cup-with-handle.test.ts の TYPICAL と同じ構成。
  const TYPICAL = [
    { date: '2026-01-05', low: 50, high: 52, volume: 3000 }, // 上昇トレンドの起点
    { date: '2026-01-20', low: 60, high: 75, volume: 2800 },
    { date: '2026-02-02', low: 95, high: 100, volume: 2600 }, // 左リム
    { date: '2026-02-20', low: 88, high: 92, volume: 900 },
    { date: '2026-03-16', low: 80, high: 85, volume: 800 }, // カップ底
    { date: '2026-04-01', low: 85, high: 90, volume: 1400 },
    { date: '2026-04-27', low: 93, high: 98, volume: 1600 }, // 右リム
    { date: '2026-05-11', low: 92, high: 95, volume: 500 }, // 基準日
  ];

  it('上昇起点から基準日までの終値系列を切り出す', () => {
    const view = buildCupWithHandleView({
      symbols,
      ohlcvObservations: { TEST: toObservations(TYPICAL) },
      generatedAt,
    });
    const asset = view.assets[0];
    expect(asset.detection).not.toBeNull();
    expect(asset.priceSeries).not.toBeNull();
    expect(asset.priceSeries![0]).toEqual({ date: '2026-01-05', close: 52 });
    expect(asset.priceSeries!.at(-1)).toEqual({ date: '2026-05-11', close: 95 });
    expect(asset.priceSeries).toHaveLength(TYPICAL.length);
  });

  it('検出されなければ priceSeries も null', () => {
    // 深さを 80% にして検出条件から外す (cup-with-handle.test.ts と同じ手法)。
    const undetected = TYPICAL.map((b) => (b.date === '2026-03-16' ? { ...b, low: 60, high: 62 } : b));
    const view = buildCupWithHandleView({
      symbols,
      ohlcvObservations: { TEST: toObservations(undetected) },
      generatedAt,
    });
    expect(view.assets[0].detection).toBeNull();
    expect(view.assets[0].priceSeries).toBeNull();
  });
});

describe('ダブルボトムの priceSeries (#260)', () => {
  function d(offset: number): string {
    const date = new Date('2026-01-01T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  // double-bottom.test.ts の TYPICAL と同じ構成。
  const TYPICAL = [
    { date: d(0), low: 63, high: 68 },
    { date: d(1), low: 62, high: 67 },
    { date: d(2), low: 61, high: 66 },
    { date: d(3), low: 60, high: 65 },
    { date: d(4), low: 59, high: 64 },
    { date: d(5), low: 58, high: 63 },
    { date: d(6), low: 50, high: 55, volume: 3000 }, // A (1つ目の安値)
    { date: d(7), low: 53, high: 58 },
    { date: d(8), low: 56, high: 61 },
    { date: d(9), low: 59, high: 64 },
    { date: d(10), low: 62, high: 67 },
    { date: d(11), low: 65, high: 70 },
    { date: d(12), low: 68, high: 73 },
    { date: d(13), low: 70, high: 80 }, // ネックライン
    { date: d(14), low: 65, high: 75 },
    { date: d(15), low: 62, high: 70 },
    { date: d(16), low: 59, high: 65 },
    { date: d(17), low: 56, high: 60 },
    { date: d(18), low: 53, high: 57 },
    { date: d(19), low: 52, high: 55 },
    { date: d(20), low: 51, high: 54, volume: 1500 }, // C (2つ目の安値)
    { date: d(21), low: 53, high: 58 },
    { date: d(22), low: 55, high: 60 },
    { date: d(23), low: 57, high: 62 },
    { date: d(24), low: 59, high: 64 },
    { date: d(25), low: 61, high: 66 },
    { date: d(26), low: 63, high: 68 },
  ];

  it('1つ目の安値から基準日までの終値系列を切り出す (上昇トレンドの前半は含めない)', () => {
    const view = buildDoubleBottomView({
      symbols,
      ohlcvObservations: { TEST: toObservations(TYPICAL) },
      generatedAt,
    });
    const asset = view.assets[0];
    expect(asset.detection).not.toBeNull();
    expect(asset.priceSeries).not.toBeNull();
    expect(asset.priceSeries![0]).toEqual({ date: d(6), close: 55 });
    expect(asset.priceSeries!.at(-1)).toEqual({ date: d(26), close: 68 });
    // d(0)〜d(5) (1つ目の安値より前) は含まれない。
    expect(asset.priceSeries!.some((p) => p.date === d(0))).toBe(false);
  });

  it('観測が少なすぎて検出できなければ priceSeries も null', () => {
    const view = buildDoubleBottomView({
      symbols,
      ohlcvObservations: { TEST: toObservations(TYPICAL.slice(0, 10)) },
      generatedAt,
    });
    expect(view.assets[0].detection).toBeNull();
    expect(view.assets[0].priceSeries).toBeNull();
  });
});

describe('ヘッド・アンド・ショルダーズ・ボトムの priceSeries (#260)', () => {
  function d(offset: number): string {
    const date = new Date('2026-01-01T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  // head-and-shoulders-bottom.test.ts の wave(TYPICAL_WAYPOINTS) と同じ構成
  // (high = low + 5 固定の折れ線)。
  const WAYPOINTS = [
    { index: 0, low: 68 },
    { index: 6, low: 50 }, // A: 左肩
    { index: 13, low: 90 }, // B: 左ネックライン点
    { index: 20, low: 20 }, // C: 頭
    { index: 27, low: 90 }, // D: 右ネックライン点
    { index: 34, low: 48 }, // E: 右肩
    { index: 40, low: 72 }, // 回復の終端 (基準日)
  ];

  function wave(): Array<{ date: string; low: number; high: number }> {
    const lows = new Map<number, number>();
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const start = WAYPOINTS[i];
      const end = WAYPOINTS[i + 1];
      const steps = end.index - start.index;
      for (let s = 0; s <= steps; s++) {
        const idx = start.index + s;
        if (lows.has(idx)) continue;
        lows.set(idx, start.low + ((end.low - start.low) * s) / steps);
      }
    }
    const maxIndex = Math.max(...WAYPOINTS.map((w) => w.index));
    const entries: Array<{ date: string; low: number; high: number }> = [];
    for (let idx = 0; idx <= maxIndex; idx++) {
      const low = lows.get(idx)!;
      entries.push({ date: d(idx), low, high: low + 5 });
    }
    return entries;
  }

  it('左肩から基準日までの終値系列を切り出す', () => {
    const entries = wave();
    const view = buildHeadAndShouldersBottomView({
      symbols,
      ohlcvObservations: { TEST: toObservations(entries) },
      generatedAt,
    });
    const asset = view.assets[0];
    expect(asset.detection).not.toBeNull();
    expect(asset.priceSeries).not.toBeNull();
    expect(asset.priceSeries![0].date).toBe(d(6));
    expect(asset.priceSeries!.at(-1)!.date).toBe(d(40));
    // 左肩 (index6) より前は含まれない。
    expect(asset.priceSeries!.some((p) => p.date === d(0))).toBe(false);
  });
});
