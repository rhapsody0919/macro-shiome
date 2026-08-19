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
  const existing = readObservations(indicatorId);
  const merged = { ...existing, ...incoming };

  // 日付順に並べ替えてから書く。Git の差分が読みやすくなる。
  const sorted: Observations = {};
  for (const date of Object.keys(merged).sort()) {
    sorted[date] = merged[date];
  }

  // **値が変わっていなければ書かない** (#140)。
  //
  // 日次バッチ (#136) では、値が動かない日でも全指標を取り直す。`updatedAt` を
  // 無条件に現在時刻で書き直していたため、値が 1 つも変わらなくても 89 ファイルが
  // 差分になり、毎日 commit と Cloudflare のビルドが走っていた (実測 90 files changed)。
  //
  // ファイル自体を触らないので、既存ファイルが無く観測も空なら作らない。
  // 空のファイルは情報を持たず、「取得できていない」と「取得したが空」の区別は
  // `gaps.json` が担う。
  if (isSameObservations(existing, sorted)) return sorted;

  const file: ObservationFile = {
    indicatorId,
    updatedAt: now.toISOString(),
    observations: sorted,
  };
  writeJson(observationPath(indicatorId), file);
  return sorted;
}

/** 観測が同一か。キーの順序には依存させない (並べ替えだけの差分で書き直さないため)。 */
function isSameObservations(a: Observations, b: Observations): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((date) => Object.is(a[date], b[date]));
}

export function readGaps(): Gap[] {
  return readJson<Gap[]>(gapsPath(), []);
}

/**
 * 欠測を記録する。同じ指標・同じ日付は上書きする (再実行で重複させない)。
 *
 * **`recordedAt` だけは最初の値を残す** (#142)。「いつ欠測を検知したか」は
 * 最初に検知した時刻であって、再検知した時刻ではない。毎回上書きすると
 * 「いつから欠測しているか」が失われ、FactSet の夏季休刊のように**継続する欠測の
 * 長さ**を後から追えなくなる。日次バッチ (#136) では再検知が毎日起きるため、
 * 差分にも効く (実測で毎回 14 件が書き換わっていた)。
 */
export function recordGaps(newGaps: readonly Gap[]): Gap[] {
  const existing = readGaps();
  const byKey = new Map<string, Gap>();
  for (const gap of existing) {
    byKey.set(`${gap.indicatorId}:${gap.date}`, gap);
  }
  for (const gap of newGaps) {
    const key = `${gap.indicatorId}:${gap.date}`;
    const before = byKey.get(key);
    // reason / detail は更新する (欠測の理由が変わることはある)。
    byKey.set(key, before === undefined ? gap : { ...gap, recordedAt: before.recordedAt });
  }

  const merged = [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.indicatorId.localeCompare(b.indicatorId) : b.date.localeCompare(a.date),
  );
  // 変化が無ければ書かない (#140 と同じ理由)。
  if (isSameGaps(existing, merged)) return merged;
  writeJson(gapsPath(), merged);
  return merged;
}

/** 欠測が同一か。並び順も込みで比べる (並べ替えだけの差分も書き直さないため)。 */
function isSameGaps(a: readonly Gap[], b: readonly Gap[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((gap, i) => {
    const other = b[i];
    return (
      gap.indicatorId === other.indicatorId &&
      gap.date === other.date &&
      gap.reason === other.reason &&
      gap.detail === other.detail &&
      gap.recordedAt === other.recordedAt
    );
  });
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
  assertFinite(value, name);
  writeJson(join(dataDir(), 'views', `${name}.json`), value);
}

/**
 * 非有限数が混ざっていないか確かめる (#113)。
 *
 * **`JSON.stringify` は NaN と Infinity を黙って `null` にする**。書いたあとでは
 * 欠測と区別できないため、書き込み前に落とすしかない。0 除算やパース失敗が
 * 「欠測」として静かに蓄積するのを防ぐ。
 */
function assertFinite(value: unknown, path: string): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`ビューに有限でない値が入っている (${path} = ${value})`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertFinite(item, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) assertFinite(item, `${path}.${key}`);
  }
}
