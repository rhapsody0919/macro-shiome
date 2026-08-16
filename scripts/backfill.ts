/**
 * 初回バックフィル (spec F-9)。
 *
 * FactSet の過去号を金曜ごとに遡って取得する。週次バッチと分けているのは、
 * 実行時間が長く (約 250 週で 20 分程度)、定時実行に混ぜたくないため。
 *
 * FRED は週次バッチが毎回全期間を取得するので、ここでは扱わない。
 *
 * 実行:
 *   pnpm tsx scripts/backfill.ts [--years 5] [--interval-ms 2000]
 */
import {
  FactsetNotPublishedError,
  fetchFactsetReport,
  previousFriday,
} from '../src/lib/adapters/factset';
import { indicators } from '../src/lib/data/indicators';
import { recordGaps, upsertObservations } from '../src/lib/data/store';
import type { Gap } from '../src/lib/data/types';

const DEFAULT_YEARS = 5;
/** 相手のサーバーに負荷をかけないための間隔。 */
const DEFAULT_INTERVAL_MS = 2000;

function parseArgs(argv: readonly string[]): { years: number; intervalMs: number } {
  const read = (flag: string, fallback: number): number => {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    const value = Number.parseInt(argv[i + 1] ?? '', 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${flag} には正の整数を指定する`);
    }
    return value;
  };
  return {
    years: read('--years', DEFAULT_YEARS),
    intervalMs: read('--interval-ms', DEFAULT_INTERVAL_MS),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { years, intervalMs } = parseArgs(process.argv.slice(2));
  const now = new Date();

  // 直近の金曜から過去へ遡る。
  const fridays: Date[] = [];
  const cursor = previousFriday(now);
  const oldest = new Date(
    Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()),
  );
  while (cursor.getTime() >= oldest.getTime()) {
    fridays.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  console.log(`バックフィルを開始 (${fridays.length} 週、間隔 ${intervalMs}ms)`);

  const factsetIndicators = Object.entries(indicators).filter(
    ([, indicator]) => indicator.source.adapter === 'factset-pdf',
  );

  const gaps: Gap[] = [];
  const failures: string[] = [];
  let fetched = 0;
  let breaks = 0;

  for (const [i, friday] of fridays.entries()) {
    const iso = friday.toISOString().slice(0, 10);
    if (i > 0) await sleep(intervalMs);

    try {
      const extract = await fetchFactsetReport(friday);
      for (const [id, indicator] of factsetIndicators) {
        if (indicator.source.adapter !== 'factset-pdf') continue;
        const value = extract[indicator.source.field];
        if (value === undefined) continue;
        upsertObservations(id, { [iso]: value }, now);
      }
      fetched += 1;
      if (fetched % 20 === 0) {
        console.log(`  ${i + 1}/${fridays.length} 週まで処理 (取得 ${fetched}、休刊 ${breaks})`);
      }
    } catch (error) {
      if (error instanceof FactsetNotPublishedError) {
        // 休刊週。夏季に 2〜3 週続くことがあり、異常ではない。
        breaks += 1;
        for (const [id] of factsetIndicators) {
          gaps.push({
            indicatorId: id,
            date: iso,
            reason: 'publication-break',
            detail: 'レポートが公開されていない',
            recordedAt: now.toISOString(),
          });
        }
        continue;
      }
      // 個別の失敗で全体を止めない。後でまとめて報告する。
      failures.push(`${iso}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  recordGaps(gaps);

  console.log(`完了: 取得 ${fetched} 週 / 休刊 ${breaks} 週 / 失敗 ${failures.length} 週`);
  if (failures.length > 0) {
    console.error('失敗した週:');
    for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
    // 一部の失敗でバックフィル全体を失敗にはしない。取れた分に価値があるため。
    // ただし件数が多い場合は取得経路の破損を疑う。
    if (failures.length > fridays.length * 0.2) {
      console.error('失敗が 2 割を超えている。取得経路が壊れている可能性がある');
      process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
