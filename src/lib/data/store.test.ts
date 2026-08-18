import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readGaps,
  readObservations,
  readStatus,
  recordGaps,
  upsertObservations,
  writeStatus,
  writeView,
} from './store';
import type { Gap } from './types';

let dir: string;
const now = new Date('2026-08-16T02:00:00Z');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'macro-shiome-store-'));
  process.env.MACRO_SHIOME_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.MACRO_SHIOME_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('upsertObservations', () => {
  it('新規の観測値を書き出す', () => {
    const result = upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    expect(result).toEqual({ '2026-08-14': 4.69 });
    expect(readObservations('dgs10')).toEqual({ '2026-08-14': 4.69 });
  });

  it('既存の値を消さずにマージする', () => {
    upsertObservations('dgs10', { '2026-08-07': 4.63 }, now);
    const result = upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    expect(result).toEqual({ '2026-08-07': 4.63, '2026-08-14': 4.69 });
  });

  it('同じ日付の再取得は上書きになる (冪等)', () => {
    // 同じ週に再実行しても重複しないことが spec F-1 の受入基準。
    upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    upsertObservations('dgs10', { '2026-08-14': 4.7 }, now);
    const result = readObservations('dgs10');
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['2026-08-14']).toBe(4.7);
  });

  it('日付順に並べて書く', () => {
    // Git の差分を読みやすくするため。
    upsertObservations('dgs10', { '2026-08-14': 2, '2026-08-07': 1 }, now);
    const raw = readFileSync(join(dir, 'observations', 'dgs10.json'), 'utf8');
    expect(raw.indexOf('2026-08-07')).toBeLessThan(raw.indexOf('2026-08-14'));
  });

  it('壊れた JSON は黙って初期化せず失敗させる', () => {
    // 初期化すると蓄積したデータが静かに消える。
    mkdirSync(join(dir, 'observations'), { recursive: true });
    writeFileSync(join(dir, 'observations', 'dgs10.json'), '{ broken', 'utf8');
    expect(() => readObservations('dgs10')).toThrow(/壊れている/);
  });
});

describe('recordGaps', () => {
  const gap = (indicatorId: string, date: string, reason: Gap['reason'] = 'publication-break'): Gap => ({
    indicatorId,
    date,
    reason,
    recordedAt: now.toISOString(),
  });

  it('欠測を記録する', () => {
    recordGaps([gap('sp500-forward-pe', '2026-08-14')]);
    expect(readGaps()).toHaveLength(1);
  });

  it('同じ指標・同じ日付は重複させない', () => {
    // 再実行で欠測が積み上がると、連続欠測の判定が狂う。
    recordGaps([gap('sp500-forward-pe', '2026-08-14')]);
    recordGaps([gap('sp500-forward-pe', '2026-08-14')]);
    expect(readGaps()).toHaveLength(1);
  });

  it('新しい日付を先頭にする', () => {
    recordGaps([gap('a', '2026-08-07'), gap('a', '2026-08-14')]);
    expect(readGaps()[0].date).toBe('2026-08-14');
  });
});

describe('writeStatus', () => {
  it('成功時は lastSuccessAt を更新する', () => {
    const status = writeStatus({ now, succeeded: true, recentGaps: [] });
    expect(status.lastSuccessAt).toBe(now.toISOString());
    expect(status.lastRunAt).toBe(now.toISOString());
  });

  it('失敗時は前回の成功時刻を保つ', () => {
    // 「最後に成功したのはいつか」が分からないと鮮度を判断できない。
    writeStatus({ now, succeeded: true, recentGaps: [] });
    const later = new Date('2026-08-23T02:00:00Z');
    const status = writeStatus({ now: later, succeeded: false, recentGaps: [] });

    expect(status.lastSuccessAt).toBe(now.toISOString());
    expect(status.lastRunAt).toBe(later.toISOString());
  });

  it('一度も成功していなければ null', () => {
    expect(writeStatus({ now, succeeded: false, recentGaps: [] }).lastSuccessAt).toBeNull();
  });

  it('欠測は直近 20 件に絞る', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      indicatorId: 'x',
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      reason: 'publication-break' as const,
      recordedAt: now.toISOString(),
    }));
    expect(writeStatus({ now, succeeded: true, recentGaps: many }).recentGaps).toHaveLength(20);
  });

  it('書き出した内容を読み戻せる', () => {
    writeStatus({ now, succeeded: true, recentGaps: [] });
    expect(readStatus()?.lastSuccessAt).toBe(now.toISOString());
  });
});

describe('writeView', () => {
  it('ビューを JSON として書き出す', () => {
    writeView('valuation', { generatedAt: now.toISOString() });
    const raw = JSON.parse(readFileSync(join(dir, 'views', 'valuation.json'), 'utf8'));
    expect(raw.generatedAt).toBe(now.toISOString());
  });
});

describe('ビューの非有限数 (#113)', () => {
  it('NaN が入っていたら書き込みを拒否する', () => {
    // JSON.stringify は NaN を null にするため、書いたあとでは欠測と区別できない。
    expect(() => writeView('test-nan', [{ date: '2026-08-14', value: Number.NaN }])).toThrow(
      /有限でない値/,
    );
  });

  it('Infinity が入っていたら書き込みを拒否する', () => {
    // 0 除算の結果が「欠測」として静かに蓄積するのを防ぐ。
    expect(() =>
      writeView('test-inf', { points: [{ v: Number.POSITIVE_INFINITY }] }),
    ).toThrow(/有限でない値/);
  });

  it('null は欠測として通す', () => {
    // 欠測は正常な状態。非有限数とは区別する。
    expect(() => writeView('test-null', [{ date: '2026-08-14', value: null }])).not.toThrow();
  });
});
