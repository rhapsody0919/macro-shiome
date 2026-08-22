/**
 * ブレイクアウト (#264) の priceSeries のビュー生成テスト。
 *
 * 検出ロジック自体は `breakout.test.ts` で検証済みなので、ここでは
 * `buildBreakoutView` が検出結果から正しい区間 (上抜けた高値の日〜基準日) の
 * 終値系列を切り出せているか、検出できない場合は `priceSeries` も `null` になるかを見る。
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

const generatedAt = '2026-08-23T02:00:00.000Z';
const symbols = [{ symbol: 'TEST', name: 'テスト銘柄' }];

// 直近20営業日の高値は index10 (high=60)。基準日 (index20) の終値が 61 でこれを上抜ける。
function typicalEntries(): Array<{ date: string } & Parameters<typeof bar>[0]> {
  const entries: Array<{ date: string } & Parameters<typeof bar>[0]> = [];
  for (let i = 0; i <= 19; i++) {
    entries.push({ date: d(i), low: 40, high: i === 10 ? 60 : 50 });
  }
  entries.push({ date: d(20), low: 55, high: 61, close: 61 });
  return entries;
}

describe('ブレイクアウトの priceSeries (#264)', () => {
  it('上抜けた高値の日から基準日までの終値系列を切り出す', () => {
    const view = buildBreakoutView({
      symbols,
      ohlcvObservations: { TEST: toObservations(typicalEntries()) },
      generatedAt,
    });
    const asset = view.assets[0];
    expect(asset.detection).not.toBeNull();
    expect(asset.detection!.breakoutDate).toBe(d(20));
    expect(asset.priceSeries).not.toBeNull();
    expect(asset.priceSeries![0]).toEqual({ date: d(10), close: 60 });
    expect(asset.priceSeries!.at(-1)).toEqual({ date: d(20), close: 61 });
    // 上抜けた高値の日 (index10) より前は含まれない。
    expect(asset.priceSeries!.some((p) => p.date === d(0))).toBe(false);
  });

  it('検出されなければ priceSeries も null', () => {
    const undetected = typicalEntries().map((e) => (e.date === d(20) ? { ...e, close: 60 } : e));
    const view = buildBreakoutView({
      symbols,
      ohlcvObservations: { TEST: toObservations(undetected) },
      generatedAt,
    });
    expect(view.assets[0].detection).toBeNull();
    expect(view.assets[0].priceSeries).toBeNull();
  });
});
