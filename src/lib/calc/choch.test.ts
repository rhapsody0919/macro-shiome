import { describe, expect, it } from 'vitest';
import { detectChoch } from './choch';
import { findStructureBreak, VOLUME_LOOKBACK_DAYS } from './structure-break';
import type { SortedBars } from './bars';
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

function bars(entries: Array<{ date: string } & Parameters<typeof bar>[0]>): SortedBars {
  return entries.map(({ date, ...rest }) => ({ date, bar: bar(rest) }));
}

function d(offset: number): string {
  const date = new Date('2026-01-01T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * 波形 (安値の谷・高値の山) を折れ線 (waypoint 間の線形補間) で組み立てる。
 * `high = low + 5` で固定しているため、`swingLength=3` で確実にスイングとして
 * 検出されるよう waypoint の間隔を空けてある (double-bottom.test.ts と同じ手法)。
 */
function wave(waypoints: Array<{ index: number; low: number }>): Array<{ date: string; low: number; high: number; close?: number }> {
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

// L1 (安値50, index6) → H1 (高値75, index13) → L2 (安値30, index20、L1より低い) →
// 回復 (index30まで、H1=75を上抜ける)
const TYPICAL_WAYPOINTS = [
  { index: 0, low: 65 },
  { index: 6, low: 50 }, // L1
  { index: 13, low: 70 }, // H1 (high = 75)
  { index: 20, low: 30 }, // L2 (L1 より低い)
  { index: 30, low: 78 }, // 回復。high=83、close はデフォルトで high と同じ
];

const LOW_VOLUME = 100;
const HIGH_VOLUME = 100_000;
/** #277 の出来高フィルタが素通りする余裕を持たせる (VOLUME_LOOKBACK_DAYS より長く)。 */
const PADDING_DAYS = VOLUME_LOOKBACK_DAYS + 5;

/**
 * 出来高確認 (#277) のテスト用に、先頭に平坦な低出来高のパディングを足す。
 * `withPadding: false` にすると基準期間 (50日) 分の観測が無い状態を作れる。
 */
function buildBars(
  entries: ReturnType<typeof wave>,
  options: { withPadding?: boolean } = {},
): SortedBars {
  const { withPadding = true } = options;
  const first = entries[0]!;
  const padding = withPadding
    ? Array.from({ length: PADDING_DAYS }, (_, i) => ({
        date: d(-(PADDING_DAYS - i)),
        low: first.low,
        high: first.high,
        volume: LOW_VOLUME,
      }))
    : [];
  return bars([...padding, ...entries.map((e) => ({ ...e, volume: LOW_VOLUME }))]);
}

/**
 * 価格・構造だけを見たいテスト向けに、出来高確認 (#277) が必ず通るデータを作る。
 *
 * (出来高を考慮しない) 構造検出だけを先に走らせてブレイクアウト日を特定し、
 * その日だけ出来高を跳ね上げる。ブレイクアウト日は線形補間の結果で決まり、
 * 手計算では特定しづらいためこの2段構成にしている。
 */
function withVolumeConfirmation(
  entries: ReturnType<typeof wave>,
  swingLength: number,
  options: { withPadding?: boolean } = {},
): SortedBars {
  const provisional = buildBars(entries, options);
  const structure = findStructureBreak(provisional, swingLength);
  if (structure === null) return provisional;

  return provisional.map((entry) =>
    entry.date === structure.breakoutDate
      ? { date: entry.date, bar: { ...entry.bar, volume: HIGH_VOLUME } }
      : entry,
  );
}

describe('detectChoch (#268)', () => {
  it('下落構造 (L1→H1→L2) の後、終値がH1を上抜けたら検出する', () => {
    const result = detectChoch(withVolumeConfirmation(wave(TYPICAL_WAYPOINTS), 3), 3);
    expect(result).not.toBeNull();
    expect(result!.firstLowDate).toBe(d(6));
    expect(result!.firstLowPrice).toBe(50);
    expect(result!.priorHighDate).toBe(d(13));
    expect(result!.priorHighPrice).toBe(75);
    expect(result!.secondLowDate).toBe(d(20));
    expect(result!.secondLowPrice).toBe(30);
    expect(result!.swingLength).toBe(3);
    // H1(75) を終値が上回る最初の足を返す (回復途中の線形補間なので厳密な日付は計算値)。
    expect(result!.breakoutPrice).toBeGreaterThan(75);
  });

  it('2つ目の安値が1つ目以上 (下落継続でない) なら検出しない', () => {
    const notLower = TYPICAL_WAYPOINTS.map((w) => (w.index === 20 ? { ...w, low: 55 } : w));
    expect(detectChoch(bars(wave(notLower)), 3)).toBeNull();
  });

  it('前回の高値をまだ上抜けていなければ検出しない', () => {
    const noBreakout = TYPICAL_WAYPOINTS.map((w) => (w.index === 30 ? { ...w, low: 60 } : w));
    expect(detectChoch(bars(wave(noBreakout)), 3)).toBeNull();
  });

  it('スイングが3点未満 (下落構造が組めない) なら検出しない', () => {
    // L1→H1 のみで L2 が無い短いデータ。
    const short = wave(TYPICAL_WAYPOINTS.slice(0, 2));
    expect(detectChoch(bars(short), 3)).toBeNull();
  });

  it('swingLength を指定すればその本数でスイングを判定する', () => {
    const result = detectChoch(withVolumeConfirmation(wave(TYPICAL_WAYPOINTS), 3), 3);
    // 既定値 (50) では waypoint の間隔が足りずスイングが確定しない。
    expect(detectChoch(bars(wave(TYPICAL_WAYPOINTS)))).toBeNull();
    expect(result).not.toBeNull();
  });
});

describe('detectChoch の出来高フィルタ (#277)', () => {
  it('出来高を伴わないブレイクアウトは検出しない', () => {
    // ブレイクアウト日の出来高を跳ね上げない (パディングと同じ平坦な出来高のまま)。
    // 価格の構造自体は成立している (最初のテストと同じ TYPICAL_WAYPOINTS)。
    const flat = buildBars(wave(TYPICAL_WAYPOINTS));
    expect(detectChoch(flat, 3)).toBeNull();
  });

  it('基準期間 (50日) 分の観測が無い銘柄は検出しない (誤検出より検出漏れを選ぶ)', () => {
    // パディング無し。構造・出来高スパイクは成立するが、平均を出す50日分の観測が無い。
    const withoutPadding = withVolumeConfirmation(wave(TYPICAL_WAYPOINTS), 3, { withPadding: false });
    expect(detectChoch(withoutPadding, 3)).toBeNull();
  });
});
