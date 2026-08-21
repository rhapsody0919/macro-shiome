import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readGaps,
  readObservations,
  readOhlcvObservations,
  readStatus,
  recordGaps,
  upsertObservations,
  upsertOhlcvObservations,
  writeStatus,
  writeView,
} from './store';
import type { Gap, OhlcvBar } from './types';

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

describe('値が変わらなければ書かない (#140)', () => {
  const pathOf = (id: string) => join(dir, 'observations', `${id}.json`);
  const mtimeOf = (id: string) => statSync(pathOf(id)).mtimeMs;

  it('同じ値で再実行してもファイルを触らない', () => {
    // 日次バッチ (#136) は値が動かない日も全指標を取り直す。ここで書き直すと
    // 89 ファイルが毎日差分になり、無意味な commit とビルドが走る。
    upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    const before = readFileSync(pathOf('dgs10'), 'utf8');
    const mtime = mtimeOf('dgs10');

    const later = new Date('2026-08-17T02:00:00Z');
    upsertObservations('dgs10', { '2026-08-14': 4.69 }, later);

    expect(readFileSync(pathOf('dgs10'), 'utf8')).toBe(before);
    expect(mtimeOf('dgs10')).toBe(mtime);
    // updatedAt が進んでいないこと。無条件に現在時刻を書いていたのが原因だった。
    expect(JSON.parse(before).updatedAt).toBe(now.toISOString());
  });

  it('値が 1 つでも変われば書く', () => {
    upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    const later = new Date('2026-08-17T02:00:00Z');
    upsertObservations('dgs10', { '2026-08-14': 4.69, '2026-08-15': 4.7 }, later);

    const file = JSON.parse(readFileSync(pathOf('dgs10'), 'utf8'));
    expect(file.updatedAt).toBe(later.toISOString());
    expect(file.observations).toEqual({ '2026-08-14': 4.69, '2026-08-15': 4.7 });
  });

  it('既存の値が別の値に変わっても書く', () => {
    // FRED の改定で過去の値が変わることがある。見落とすと古い値が残り続ける。
    upsertObservations('dgs10', { '2026-08-14': 4.69 }, now);
    const later = new Date('2026-08-17T02:00:00Z');
    upsertObservations('dgs10', { '2026-08-14': 4.7 }, later);

    expect(readObservations('dgs10')).toEqual({ '2026-08-14': 4.7 });
    expect(JSON.parse(readFileSync(pathOf('dgs10'), 'utf8')).updatedAt).toBe(later.toISOString());
  });

  it('観測が空で既存ファイルも無ければ作らない', () => {
    // 空のファイルは情報を持たない。取得できなかったことは gaps.json が持つ。
    expect(upsertObservations('never-fetched', {}, now)).toEqual({});
    expect(existsSync(pathOf('never-fetched'))).toBe(false);
  });
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

describe('upsertOhlcvObservations (#229)', () => {
  const bar: OhlcvBar = { open: 770.1, high: 775.5, low: 768.2, close: 772.6, volume: 12_345_678 };
  const pathOf = (symbol: string) => join(dir, 'observations', `ohlcv-${symbol.toLowerCase()}.json`);

  it('小文字ファイル名で書き出す', () => {
    upsertOhlcvObservations('SPY', { '2026-08-20': bar }, now);
    expect(existsSync(pathOf('SPY'))).toBe(true);
    expect(readOhlcvObservations('SPY')).toEqual({ '2026-08-20': bar });
  });

  it('既存の値を消さずにマージする', () => {
    upsertOhlcvObservations('SPY', { '2026-08-19': bar }, now);
    const later = { ...bar, close: 780.0 };
    upsertOhlcvObservations('SPY', { '2026-08-20': later }, now);
    expect(readOhlcvObservations('SPY')).toEqual({ '2026-08-19': bar, '2026-08-20': later });
  });

  it('値が変わらなければファイルを触らない (#140 と同じ)', () => {
    upsertOhlcvObservations('SPY', { '2026-08-20': bar }, now);
    const mtime = statSync(pathOf('SPY')).mtimeMs;

    const later = new Date('2026-08-21T02:00:00Z');
    upsertOhlcvObservations('SPY', { '2026-08-20': bar }, later);

    expect(statSync(pathOf('SPY')).mtimeMs).toBe(mtime);
  });

  it('1 つのフィールドでも変われば書く', () => {
    upsertOhlcvObservations('SPY', { '2026-08-20': bar }, now);
    const later = new Date('2026-08-21T02:00:00Z');
    upsertOhlcvObservations('SPY', { '2026-08-20': { ...bar, volume: 1 } }, later);

    const file = JSON.parse(readFileSync(pathOf('SPY'), 'utf8'));
    expect(file.updatedAt).toBe(later.toISOString());
    expect(file.observations['2026-08-20'].volume).toBe(1);
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

  describe('再検知で書き換えない (#142)', () => {
    const gapsPath = () => join(dir, 'gaps.json');
    const later = new Date('2026-08-19T02:00:00Z');

    it('同じ欠測を再検知しても recordedAt を進めない', () => {
      // 「いつから欠測しているか」は最初に検知した時刻。再検知で上書きすると
      // FactSet の夏季休刊のような継続欠測の長さを後から追えなくなる。
      recordGaps([gap('sp500-forward-pe', '2026-08-14')]);
      const before = readFileSync(gapsPath(), 'utf8');
      const mtime = statSync(gapsPath()).mtimeMs;

      recordGaps([
        { ...gap('sp500-forward-pe', '2026-08-14'), recordedAt: later.toISOString() },
      ]);

      expect(readGaps()[0].recordedAt).toBe(now.toISOString());
      // 変化が無いのでファイル自体を触らない (日次バッチの無意味な差分を止める)。
      expect(readFileSync(gapsPath(), 'utf8')).toBe(before);
      expect(statSync(gapsPath()).mtimeMs).toBe(mtime);
    });

    it('欠測の理由が変われば更新する。ただし recordedAt は最初のまま', () => {
      recordGaps([gap('sp500-forward-pe', '2026-08-14', 'publication-break')]);
      recordGaps([
        {
          ...gap('sp500-forward-pe', '2026-08-14', 'not-in-report'),
          recordedAt: later.toISOString(),
        },
      ]);

      const [saved] = readGaps();
      expect(saved.reason).toBe('not-in-report');
      expect(saved.recordedAt).toBe(now.toISOString());
    });

    it('新しい欠測は記録する', () => {
      recordGaps([gap('a', '2026-08-14')]);
      recordGaps([{ ...gap('b', '2026-08-14'), recordedAt: later.toISOString() }]);

      expect(readGaps()).toHaveLength(2);
      expect(readGaps().find((g) => g.indicatorId === 'b')?.recordedAt).toBe(later.toISOString());
    });
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
