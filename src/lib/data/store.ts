/**
 * データファイルの読み書き (ADR-0001: DB を使わず Git 内 JSON)。
 *
 * **Node 専用**。ファイルシステムを使うため、フロントエンドからは import しない
 * (画面は生成済みの JSON を fetch する)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Observations } from '../adapters/fred';
import type { BatchStatus, Gap, ObservationFile } from './types';

/**
 * データディレクトリ。既定はリポジトリ直下の `data/`。
 * 呼び出しごとに評価するのは、テストで環境変数から差し替えられるようにするため。
 */
export function dataDir(): string {
  return process.env.MACRO_SHIOME_DATA_DIR ?? join(process.cwd(), 'data');
}

const gapsPath = () => join(dataDir(), 'gaps.json');
const statusPath = () => join(dataDir(), 'status.json');

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  // 末尾に改行を付けて、Git の差分を行単位で読めるようにする。
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (cause) {
    // 壊れたファイルを黙って初期化すると、蓄積したデータが静かに消える。
    throw new Error(
      `${path} の JSON が壊れている: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

function observationPath(indicatorId: string): string {
  return join(dataDir(), 'observations', `${indicatorId}.json`);
}

export function readObservations(indicatorId: string): Observations {
  const file = readJson<ObservationFile | null>(observationPath(indicatorId), null);
  return file?.observations ?? {};
}

/**
 * 観測値を UPSERT する。
 *
 * 観測日をキーにしているため、同じ週に再実行しても同じキーが上書きされるだけで
 * 重複しない (spec F-1 の冪等性を構造で保証する)。
 * 既存の値は消さず、新しく取れた分だけを上書きする。
 */
export function upsertObservations(
  indicatorId: string,
  incoming: Observations,
  now: Date,
): Observations {
  const merged = { ...readObservations(indicatorId), ...incoming };

  // 日付順に並べ替えてから書く。Git の差分が読みやすくなる。
  const sorted: Observations = {};
  for (const date of Object.keys(merged).sort()) {
    sorted[date] = merged[date];
  }

  const file: ObservationFile = {
    indicatorId,
    updatedAt: now.toISOString(),
    observations: sorted,
  };
  writeJson(observationPath(indicatorId), file);
  return sorted;
}

export function readGaps(): Gap[] {
  return readJson<Gap[]>(gapsPath(), []);
}

/** 欠測を記録する。同じ指標・同じ日付は上書きする (再実行で重複させない)。 */
export function recordGaps(newGaps: readonly Gap[]): Gap[] {
  const byKey = new Map<string, Gap>();
  for (const gap of [...readGaps(), ...newGaps]) {
    byKey.set(`${gap.indicatorId}:${gap.date}`, gap);
  }

  const merged = [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.indicatorId.localeCompare(b.indicatorId) : b.date.localeCompare(a.date),
  );
  writeJson(gapsPath(), merged);
  return merged;
}

export function readStatus(): BatchStatus | null {
  return readJson<BatchStatus | null>(statusPath(), null);
}

/**
 * 実行状況を書く (screens N-1 の鮮度表示に使う)。
 * `lastSuccessAt` は成功時だけ更新する。失敗が続いても「最後に成功した時刻」が残る。
 */
export function writeStatus(options: {
  now: Date;
  succeeded: boolean;
  recentGaps: readonly Gap[];
}): BatchStatus {
  const previous = readStatus();
  const status: BatchStatus = {
    lastSuccessAt: options.succeeded ? options.now.toISOString() : (previous?.lastSuccessAt ?? null),
    lastRunAt: options.now.toISOString(),
    recentGaps: options.recentGaps.slice(0, 20),
  };
  writeJson(statusPath(), status);
  return status;
}

export function writeView(name: string, value: unknown): void {
  writeJson(join(dataDir(), 'views', `${name}.json`), value);
}
