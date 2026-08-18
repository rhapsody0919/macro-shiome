/**
 * 週次バッチ本体 (spec F-1)。
 *
 * 取得 → 検証 → 保存 → ビュー生成 の順で実行する。
 *
 * 失敗の扱い:
 * - **FactSet の 404 は欠測**として記録し、処理を続ける (夏季休刊が実在するため)
 * - それ以外の失敗は記録して続行し、**最後に job を失敗させる**
 * - 取れたデータはコミットする。ただし job は赤にする。
 *   「緑だが歯抜け」が最も危険なため (plan 4-2)
 *
 * 実行:
 *   FRED_API_KEY=xxxx pnpm tsx scripts/fetch-weekly.ts [--start YYYY-MM-DD]
 */
import { FredClient, readFredApiKeyFromEnv } from '../src/lib/adapters/fred';
import {
  FactsetNotPublishedError,
  fetchFactsetReport,
  previousFriday,
} from '../src/lib/adapters/factset';
import { fetchEtfField } from '../src/lib/adapters/stockanalysis';
import { TreasuryClient } from '../src/lib/adapters/treasury';
import {
  buildEconomyView,
  buildMacroView,
  buildRevisionSeries,
  buildValuationView,
  type ObservationMap,
} from '../src/lib/calc/view';
import { appConfig, indicators } from '../src/lib/data/indicators';
import {
  readObservations,
  recordGaps,
  upsertObservations,
  writeStatus,
  writeView,
} from '../src/lib/data/store';
import type { Gap } from '../src/lib/data/types';
import {
  assertNoIssues,
  checkCloseConsistency,
  checkRange,
  checkWeekOverWeek,
  type ValidationIssue,
} from '../src/lib/validation/checks';

/** ビューの起点。FRED の S&P 500 が 10 年しか無いためそれに合わせる。 */
const DEFAULT_VIEW_START_YEARS = 10;

function parseArgs(argv: readonly string[]): { start?: string } {
  const startIndex = argv.indexOf('--start');
  if (startIndex === -1) return {};
  const value = argv[startIndex + 1];
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--start は YYYY-MM-DD 形式で指定する');
  }
  return { start: value };
}

async function main(): Promise<void> {
  const now = new Date();
  const args = parseArgs(process.argv.slice(2));
  const friday = previousFriday(now);
  const fridayIso = friday.toISOString().slice(0, 10);

  const failures: string[] = [];
  const gaps: Gap[] = [];
  const issues: ValidationIssue[] = [];
  const observationMap: Record<string, Record<string, number>> = {};

  console.log(`週次バッチを開始 (基準日 ${fridayIso})`);

  // --- 1. FRED ---
  // 失敗しても他の取得は続ける。取れた分は保存する。
  try {
    const fred = new FredClient({ apiKey: readFredApiKeyFromEnv() });
    for (const [id, indicator] of Object.entries(indicators)) {
      if (indicator.source.adapter !== 'fred') continue;
      try {
        // **当日より後の観測は取らない** (#93)。GDPPOT のように将来の四半期まで
        // 推計値を返す系列があり、そのまま保存すると未来まで線が伸びる。
        // 観測値が未来日付になる系列は本来存在しないので、全系列に掛けてよい。
        const observations = await fred.fetchSeries(indicator.source.seriesId, {
          end: now.toISOString().slice(0, 10),
        });
        observationMap[id] = upsertObservations(id, observations, now);
        console.log(`  FRED ${id}: ${Object.keys(observations).length} 件`);
      } catch (error) {
        failures.push(`FRED ${id}: ${message(error)}`);
      }
    }
  } catch (error) {
    // API キー未設定など、クライアントを作れない場合。
    failures.push(`FRED クライアントの初期化に失敗: ${message(error)}`);
  }

  // --- 2. FactSet ---
  try {
    const extract = await fetchFactsetReport(friday);
    for (const [id, indicator] of Object.entries(indicators)) {
      if (indicator.source.adapter !== 'factset-pdf') continue;
      const value = extract[indicator.source.field];
      if (value === undefined) {
        // 項目単位の欠落。**号によって記載が無い項目と、抽出に失敗した項目を区別する** (#53)。
        // 前者を「取得失敗」として記録すると、正常な欠測が毎週の調査対象になってしまう。
        if (indicator.optionalInReport === true) {
          gaps.push(gap(id, fridayIso, 'not-in-report', 'この号に該当項目の記載が無い', now));
        } else {
          gaps.push(gap(id, fridayIso, 'fetch-failed', '本文から該当項目を抽出できなかった', now));
        }
        continue;
      }
      observationMap[id] = upsertObservations(id, { [fridayIso]: value }, now);
    }
    console.log(`  FactSet: ${Object.keys(extract).length} 項目`);
  } catch (error) {
    if (error instanceof FactsetNotPublishedError) {
      // 休刊週。異常ではないので job は失敗させない。
      console.log(`  FactSet: ${fridayIso} は未公開 (休刊週として記録)`);
      for (const [id, indicator] of Object.entries(indicators)) {
        if (indicator.source.adapter !== 'factset-pdf') continue;
        gaps.push(gap(id, fridayIso, 'publication-break', 'レポートが公開されていない', now));
      }
    } else {
      failures.push(`FactSet: ${message(error)}`);
    }
  }

  // --- 3. stockanalysis ---
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'stockanalysis') continue;
    try {
      const value = await fetchEtfField(indicator.source.symbol, indicator.source.field);
      observationMap[id] = upsertObservations(id, { [fridayIso]: value }, now);
      console.log(`  stockanalysis ${id}: ${value}`);
    } catch (error) {
      failures.push(`stockanalysis ${id}: ${message(error)}`);
    }
  }

  // --- 3b. 米財務省 (国債入札) ---
  // 全期間を毎回取り直す。件数が 400 弱と小さく、差分取得の複雑さに見合わない。
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'treasury') continue;
    try {
      const observations = await new TreasuryClient().fetchTenYearBidToCover();
      observationMap[id] = upsertObservations(id, observations, now);
      console.log(`  treasury ${id}: ${Object.keys(observations).length} 件`);
    } catch (error) {
      failures.push(`treasury ${id}: ${message(error)}`);
    }
  }

  // --- 4. 検証 ---
  for (const [id, indicator] of Object.entries(indicators)) {
    const observations = observationMap[id] ?? readObservations(id);

    // **範囲は「各系列の最新値」で見る** (#102)。以前は基準日 (金曜) の値だけを
    // 見ていたため、月次・四半期・入札のように金曜に値が立たない系列と、
    // 発表が 1 週遅れる系列 (信用状況など) が丸ごと検証されていなかった。
    const latestDate = Object.keys(observations).sort().at(-1);
    if (latestDate !== undefined) {
      issues.push(...checkRange(id, indicator, latestDate, observations[latestDate]));
    }

    // 前週比は週次グリッドが前提なので、従来どおり基準日の値だけを見る。
    const value = observations[fridayIso];
    if (value === undefined) continue;
    const previousValue = previousWeekValue(observations, fridayIso);
    issues.push(...checkWeekOverWeek(id, indicator, fridayIso, value, previousValue));
  }

  issues.push(
    ...checkCloseConsistency(
      observationMap['sp500-close-factset']?.[fridayIso],
      observationMap['sp500']?.[fridayIso],
      fridayIso,
    ),
  );

  // --- 5. 保存 ---
  const allGaps = recordGaps(gaps);

  const start =
    args.start ??
    new Date(Date.UTC(now.getUTCFullYear() - DEFAULT_VIEW_START_YEARS, now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

  const observations: ObservationMap = Object.fromEntries(
    Object.keys(indicators).map((id) => [id, observationMap[id] ?? readObservations(id)]),
  );

  writeView('valuation', buildValuationView({ observations, config: appConfig, start, today: now }));
  writeView('revisions', buildRevisionSeries({ observations, config: appConfig, start, today: now }));
  writeView('macro', buildMacroView({ observations, config: appConfig, start, today: now }));
  // 月次指標は週次グリッドに載せない (#64)。別ビューとして持つ。
  writeView('economy', buildEconomyView({ observations, config: appConfig, start, today: now }));

  const succeeded = failures.length === 0 && issues.length === 0;
  writeStatus({ now, succeeded, recentGaps: allGaps });

  // --- 6. 結果 ---
  if (issues.length > 0) {
    console.error('検証に失敗した項目がある:');
    try {
      assertNoIssues(issues);
    } catch (error) {
      console.error(message(error));
    }
  }
  if (failures.length > 0) {
    console.error('取得に失敗した項目がある:');
    for (const failure of failures) console.error(`  - ${failure}`);
  }

  if (!succeeded) {
    // 取れたデータは保存済み。ただし job は赤にして気付けるようにする。
    console.error('一部が失敗したため job を失敗として終了する (取得できた分は保存済み)');
    process.exitCode = 1;
    return;
  }

  console.log('週次バッチが完了した');
}

function gap(
  indicatorId: string,
  date: string,
  reason: Gap['reason'],
  detail: string,
  now: Date,
): Gap {
  return { indicatorId, date, reason, detail, recordedAt: now.toISOString() };
}

/** 1 週間前の値を返す。前週比の検証に使う。 */
function previousWeekValue(
  observations: Record<string, number>,
  date: string,
): number | undefined {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 7);
  return observations[cursor.toISOString().slice(0, 10)];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// top-level await は使わない。package.json に "type": "module" が無いため
// tsx が CJS として扱い、Transform エラーになる。
// catch を明示することで、未処理の rejection でログが出ないまま落ちるのも防ぐ。
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
