/**
 * 指標の値検証 (#113)。
 *
 * **実装が動くこと**ではなく**表示している数値が正しいこと**を確かめる。
 * 値が静かに間違っていても画面は正常に見えるため、「緑だが検証していない」状態が
 * このアプリで最も危険。実際に起きた失敗はすべてこの型だった (#66 / #96 / #100 / #102 / #110)。
 *
 * **実装と違う経路で照合する**のが要件。同じコードを通すと同じ間違いをする。
 * FRED は API キーを使わない CSV 経路 (`fredgraph.csv`) で取り直す。
 *
 * 実行:
 *   pnpm verify [--offline]
 *
 * `--offline` はネットワークを使う照合 (1・2) を飛ばす。CI やオフラインでの
 * 構造チェックに使う。
 */
import { readFileSync, existsSync } from 'node:fs';
import { indicators } from '../src/lib/data/indicators';
import { readObservations } from '../src/lib/data/store';
import { checkRange } from '../src/lib/validation/checks';
import { TreasuryClient } from '../src/lib/adapters/treasury';
import type { Observations } from '../src/lib/adapters/fred';

interface Failure {
  check: string;
  detail: string;
}

const failures: Failure[] = [];
const fail = (check: string, detail: string) => failures.push({ check, detail });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 相対誤差。値の大きさに依らず同じ基準で比べる。 */
function differs(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) / Math.max(1, Math.abs(b)) > tolerance;
}

function readView(name: string): unknown {
  const path = `data/views/${name}.json`;
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** FRED の CSV 経路。**API キーを使わない**ので、取得実装とは別経路になる。 */
async function fetchFredCsv(seriesId: string): Promise<Observations> {
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const observations: Observations = {};
  for (const line of (await response.text()).split('\n')) {
    const [date, value] = line.split(',');
    if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (value === undefined || value.trim() === '' || value.trim() === '.') continue;
    observations[date] = Number(value);
  }
  return observations;
}

/** 1. 取得値が一次情報と一致するか。直近 30 点を見る。 */
async function verifySources(): Promise<void> {
  console.log('1. 一次情報との照合');
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'fred') continue;
    const stored = readObservations(id);
    const dates = Object.keys(stored).sort();
    if (dates.length === 0) continue;

    let live: Observations;
    try {
      live = await fetchFredCsv(indicator.source.seriesId);
    } catch (error) {
      fail('一次情報との照合', `${id}: 取得に失敗 (${String(error)})`);
      continue;
    }
    for (const date of dates.slice(-30)) {
      const expected = live[date];
      if (expected === undefined) {
        fail('一次情報との照合', `${id}: FRED に無い日付を保存している (${date})`);
        continue;
      }
      if (differs(stored[date], expected)) {
        fail(
          '一次情報との照合',
          `${id} @${date}: 保存 ${stored[date]} / FRED ${expected}`,
        );
      }
    }
    await sleep(250);
  }

  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'treasury') continue;
    const stored = readObservations(id);
    const live = await new TreasuryClient().fetchTenYearBidToCover();
    for (const [date, value] of Object.entries(stored)) {
      if (live[date] === undefined) {
        fail('一次情報との照合', `${id}: 財務省 API に無い日付 (${date})`);
      } else if (differs(value, live[date])) {
        fail('一次情報との照合', `${id} @${date}: 保存 ${value} / API ${live[date]}`);
      }
    }
  }
  console.log(`   FRED / 財務省の系列を照合した`);
}

/** 2. 観測に当日より後の日付が無いか (#100 の型)。 */
function verifyNoFutureObservations(today: string): void {
  console.log('2. 将来日付の混入');
  for (const id of Object.keys(indicators)) {
    const future = Object.keys(readObservations(id)).filter((date) => date > today);
    if (future.length > 0) {
      fail(
        '将来日付の混入',
        `${id}: ${future.length} 件が当日より後 (最大 ${future.sort().at(-1)})。` +
          '推計値を含む系列は取得時に切ること',
      );
    }
  }
}

/** 3. 全系列の最新値が指標マスタの範囲に収まるか (#102 の型)。 */
function verifyRanges(): void {
  console.log('3. 最新値の範囲');
  for (const [id, indicator] of Object.entries(indicators)) {
    const observations = readObservations(id);
    const latest = Object.keys(observations).sort().at(-1);
    if (latest === undefined) continue;
    for (const issue of checkRange(id, indicator, latest, observations[latest])) {
      fail('最新値の範囲', `${id}: ${issue.message} @${issue.date}`);
    }
  }
}

/**
 * 4. ビューの時系列が昇順で重複が無いか。
 *
 * **非有限数はここでは見ない**。`JSON.stringify` が NaN と Infinity を `null` に
 * するため、書かれた JSON を読んでも検出できない。書き込み前に落とす形で
 * `writeView` 側に置いてある。
 */
function verifySeriesOrder(): void {
  console.log('4. 時系列の順序と重複');
  const inspect = (rows: unknown, key: string, label: string): void => {
    if (!Array.isArray(rows)) return;
    const keys = rows.map((row) => (row as Record<string, unknown>)[key] as string);
    const sorted = [...keys].sort();
    if (keys.join() !== sorted.join()) fail('時系列の順序と重複', `${label}: 昇順でない`);
    if (new Set(keys).size !== keys.length) fail('時系列の順序と重複', `${label}: 重複がある`);
  };
  const valuation = readView('valuation') as Record<string, { points: unknown }> | null;
  if (valuation !== null) {
    for (const key of ['sp500', 'nasdaq100']) inspect(valuation[key].points, 'date', key);
  }
  inspect(readView('macro'), 'date', 'macro');
  inspect((readView('economy') as { monthly: unknown } | null)?.monthly, 'month', 'economy');
  inspect(readView('revisions'), 'date', 'revisions');
}

/**
 * 5. 導出値が定義どおりか。
 *
 * **ビュー生成のコードを呼ばずに**計算し直す。同じ関数を使うと、
 * 定義そのものが間違っていた場合に一致してしまう。
 */
function verifyDerived(): void {
  console.log('5. 導出値の再計算');
  const valuation = readView('valuation') as {
    sp500: { points: Record<string, number | null>[] };
    nasdaq100: { points: Record<string, number | null>[] };
  } | null;
  const macro = readView('macro') as Record<string, number | null>[] | null;
  if (valuation === null || macro === null) return;

  // generatedAt などの指数以外のキーが混ざるため、指数だけを回す。
  for (const key of ['sp500', 'nasdaq100'] as const) {
    for (const point of valuation[key].points) {
      const { trailingPe, index, trailingEps, earningsYield, realRate, yieldSpread } = point;
      const date = String(point.date);
      // 実績 EPS = 終値 ÷ 実績 PER。S&P 500 は FactSet 終値、NASDAQ-100 は指数 (#110)。
      const basis = point.fairValueBasis;
      if (basis !== null && trailingPe !== null && trailingEps !== null) {
        if (differs(trailingEps, basis / trailingPe, 1e-9)) {
          fail('導出値の再計算', `${key} @${date}: 実績EPS が 終値 ÷ 実績PER と一致しない`);
        }
      }
      // 割高率は比較基準に対して計算する (#110)。
      if (point.fairValue !== null && basis !== null && point.overvaluation !== null) {
        if (differs(point.overvaluation, (1 - point.fairValue / basis) * 100, 1e-9)) {
          fail('導出値の再計算', `${key} @${date}: 割高率が比較基準と合わない`);
        }
      }
      // イールドスプレッド = 益回り − 実質金利。
      if (earningsYield !== null && realRate !== null && yieldSpread !== null) {
        if (differs(yieldSpread, earningsYield - realRate, 1e-9)) {
          fail('導出値の再計算', `${key} @${date}: スプレッドが 益回り − 実質金利 と合わない`);
        }
      }
      if (index !== null && basis !== null && key === 'nasdaq100' && index !== basis) {
        fail('導出値の再計算', `${key} @${date}: 比較基準が指数と一致しない`);
      }
    }
  }

  for (const point of macro) {
    const date = String(point.date);
    const { nominalRate, breakeven, realRate, potentialGrowth, treasuryFairValue } = point;
    if (nominalRate !== null && breakeven !== null && realRate !== null) {
      if (differs(realRate, nominalRate - breakeven, 1e-9)) {
        fail('導出値の再計算', `macro @${date}: 実質金利が 名目 − 期待インフレ率 と合わない`);
      }
    }
    if (breakeven !== null && potentialGrowth !== null && treasuryFairValue !== null) {
      if (differs(treasuryFairValue, breakeven + potentialGrowth, 1e-9)) {
        fail('導出値の再計算', `macro @${date}: 理論値が 期待インフレ率 + 潜在成長率 と合わない`);
      }
    }
  }
}

async function main(): Promise<void> {
  const offline = process.argv.includes('--offline');
  const today = new Date().toISOString().slice(0, 10);

  if (offline) {
    console.log('1. 一次情報との照合 — --offline のため飛ばす');
  } else {
    await verifySources();
  }
  verifyNoFutureObservations(today);
  verifyRanges();
  verifySeriesOrder();
  verifyDerived();

  console.log('');
  if (failures.length === 0) {
    console.log('すべての検証を通過した');
    return;
  }
  console.error(`${failures.length} 件の検証に失敗:`);
  for (const { check, detail } of failures) console.error(`  [${check}] ${detail}`);
  process.exitCode = 1;
}

void main();
