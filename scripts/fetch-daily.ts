/**
 * 定期バッチ本体 (spec F-1)。**UTC 毎日 02:00** に走る (#136)。
 *
 * 取得 → 検証 → 保存 → ビュー生成 の順で実行する。
 *
 * 日次にした理由: 無料枠では日次ヒストリカルを取れる経路が無い
 * (Finnhub の `/stock/candle` は Basic 以上)。現在値を毎日積み上げるしかない。
 * 土日は値が動かず `data/` に差分が出ないため、コミットもビルドも走らない。
 *
 * 失敗の扱い:
 * - **FactSet の 404 は欠測**として記録し、処理を続ける (夏季休刊が実在するため)
 * - それ以外の失敗は記録して続行し、**最後に job を失敗させる**
 * - 取れたデータはコミットする。ただし job は赤にする。
 *   「緑だが歯抜け」が最も危険なため (plan 4-2)
 *
 * 実行:
 *   FRED_API_KEY=xxxx pnpm tsx scripts/fetch-daily.ts [--start YYYY-MM-DD]
 */
import { FredClient, readFredApiKeyFromEnv } from '../src/lib/adapters/fred';
import {
  FactsetNotPublishedError,
  fetchFactsetReport,
  previousFriday,
} from '../src/lib/adapters/factset';
import { fetchEtfField, lastClosedTradingDay } from '../src/lib/adapters/stockanalysis';
import { TreasuryClient } from '../src/lib/adapters/treasury';
import type { IndicatorSource } from '../src/lib/data/types';
import { FinnhubClient, readFinnhubApiKeyFromEnv } from '../src/lib/adapters/finnhub';
import { TiingoClient, readTiingoApiKeyFromEnv } from '../src/lib/adapters/tiingo';
import { TIINGO_ASSETS, TIINGO_SYMBOLS } from '../src/lib/data/tiingo-assets';
import { fetchEstatIndicator } from '../src/lib/adapters/estat-dashboard';
import { EstatClient, readEstatAppIdFromEnv } from '../src/lib/adapters/estat-api';
import { DAILY_VIEWS } from '../src/lib/data/daily-series';
import {
  buildDrawdownView,
  buildEconomyView,
  buildHighTightFlagView,
  buildMacroView,
  buildDailyView,
  buildRevisionSeries,
  buildValuationView,
  type ObservationMap,
} from '../src/lib/calc/view';
import { appConfig, indicators } from '../src/lib/data/indicators';
import { DRAWDOWN_ASSETS } from '../src/lib/data/drawdown-assets';
import drawdownSeed from '../data/seed/stock-bot-drawdown.json';
import {
  readObservations,
  readOhlcvObservations,
  recordGaps,
  upsertObservations,
  upsertOhlcvObservations,
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

/**
 * 財務省の 3 つの表を出し分ける (#222)。
 *
 * どの表を引くかは指標マスタが決める。ここで分岐を持たないと、指標を足すたびに
 * 取得側にも条件を書き足すことになる。
 */
async function fetchTreasury(
  source: Extract<IndicatorSource, { adapter: 'treasury' }>,
): Promise<Record<string, number>> {
  const client = new TreasuryClient();
  if ('avgRate' in source) return client.fetchAvgRate(source.avgRate);
  if ('debt' in source) return client.fetchDebtHeldByPublic();
  return client.fetchTenYearBidToCover();
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
      // **基準日 (金曜) ではなく「値が指す日」で保存する** (#125)。
      // 取れるのは現在値だけなので、基準日で保存すると手動実行のたびに
      // 実行日の値が金曜の値として上書きされる (実測で確認済み)。
      const observedOn = lastClosedTradingDay(now);
      observationMap[id] = upsertObservations(id, { [observedOn]: value }, now);
      console.log(`  stockanalysis ${id}: ${value} (${observedOn} 時点)`);
    } catch (error) {
      failures.push(`stockanalysis ${id}: ${message(error)}`);
    }
  }

  // --- 3c. Finnhub (ETF の終値) ---
  // 現在値しか取れないので **値が指す日** (直前の取引日) をキーにする (#125 と同じ)。
  {
    const finnhubIds = Object.entries(indicators).filter(
      ([, indicator]) => indicator.source.adapter === 'finnhub',
    );
    if (finnhubIds.length > 0) {
      const observedOn = lastClosedTradingDay(now);
      try {
        const finnhub = new FinnhubClient({ apiKey: readFinnhubApiKeyFromEnv() });
        for (const [id, indicator] of finnhubIds) {
          if (indicator.source.adapter !== 'finnhub') continue;
          try {
            const price = await finnhub.fetchPrice(indicator.source.symbol);
            observationMap[id] = upsertObservations(id, { [observedOn]: price }, now);
          } catch (error) {
            failures.push(`finnhub ${id}: ${message(error)}`);
          }
        }
        console.log(`  finnhub: ${finnhubIds.length} 銘柄 (${observedOn} 時点)`);
      } catch (error) {
        // キー未設定などで 1 件も取れない場合。
        failures.push(`finnhub: ${message(error)}`);
      }
    }
  }

  // --- 3b. 米財務省 (国債の入札・平均利率・残高) ---
  // 全期間を毎回取り直す。最大でも 8,374 件と小さく、差分取得の複雑さに見合わない。
  for (const [id, indicator] of Object.entries(indicators)) {
    const source = indicator.source;
    if (source.adapter !== 'treasury') continue;
    try {
      const observations = await fetchTreasury(source);
      observationMap[id] = upsertObservations(id, observations, now);
      console.log(`  treasury ${id}: ${Object.keys(observations).length} 件`);
    } catch (error) {
      failures.push(`treasury ${id}: ${message(error)}`);
    }
  }

  // --- 3d. 統計ダッシュボード (日本の指標) ---
  // 全期間を毎回取り直す。1983 年からでも 522 点と小さく、差分取得に見合わない。
  // 月次なので日次バッチでも値はほとんど動かず、#140 により差分が出なければ書かない。
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter !== 'estat') continue;
    try {
      const observations = await fetchEstatIndicator(indicator.source);
      observationMap[id] = upsertObservations(id, observations, now);
      console.log(`  estat ${id}: ${Object.keys(observations).length} 件`);
    } catch (error) {
      failures.push(`estat ${id}: ${message(error)}`);
    }
  }

  // --- 3e. e-Stat 統計 API (統計ダッシュボードに無い表) ---
  // **appId が要る唯一の経路** (#160)。値もエラーもログに出さない。
  {
    const ids = Object.entries(indicators).filter(
      ([, indicator]) => indicator.source.adapter === 'estat-api',
    );
    if (ids.length > 0) {
      try {
        const client = new EstatClient({ appId: readEstatAppIdFromEnv() });
        for (const [id, indicator] of ids) {
          if (indicator.source.adapter !== 'estat-api') continue;
          try {
            const observations = await client.fetchTable(indicator.source);
            observationMap[id] = upsertObservations(id, observations, now);
            console.log(`  estat-api ${id}: ${Object.keys(observations).length} 件`);
          } catch (error) {
            failures.push(`estat-api ${id}: ${message(error)}`);
          }
        }
      } catch (error) {
        // appId 未設定はここで 1 回だけ報告する。
        failures.push(`estat-api: ${message(error)}`);
      }
    }
  }

  // --- 3f. Tiingo (ETF の日足 OHLCV、#229、ADR-0008) ---
  // 指標マスタを経由しない (OHLCV は 1 指標 = 1 系列のスカラー値を前提にした
  // 指標マスタと型が合わないため、ADR-0008)。36 銘柄を無料枠 (1 時間 50 件)
  // の間隔で取得すると約 48 分かかるため、他の独立した取得の後・検証の前に置く
  // (Treasury/e-Stat を巻き添えで遅延させないため)。
  {
    const fallbackSinceDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    try {
      const tiingo = new TiingoClient({ apiKey: readTiingoApiKeyFromEnv() });
      let skippedCount = 0;
      for (const symbol of TIINGO_SYMBOLS) {
        try {
          // **既存の最新観測日から取り直す。** 固定 10 日前だと、10 日を超える
          // 障害 (キー失効など) から復旧しても、それ以前の欠測が永久に埋まらない。
          const existingDates = Object.keys(readOhlcvObservations(symbol)).sort();
          const sinceDate = existingDates.at(-1) ?? fallbackSinceDate;
          const { bars, skipped } = await tiingo.fetchRecentBars(symbol, sinceDate);
          const observations = Object.fromEntries(bars.map(({ date, bar }) => [date, bar]));
          upsertOhlcvObservations(symbol, observations, now);
          for (const { date, reason } of skipped) {
            failures.push(`tiingo ${symbol} @${date}: ${reason}`);
            skippedCount += 1;
          }
        } catch (error) {
          failures.push(`tiingo ${symbol}: ${message(error)}`);
        }
      }
      const skippedNote = skippedCount > 0 ? ` (${skippedCount} 日分をスキップ)` : '';
      console.log(`  tiingo: ${TIINGO_SYMBOLS.length} 銘柄${skippedNote}`);
    } catch (error) {
      // キー未設定などで 1 件も取れない場合。
      failures.push(`tiingo: ${message(error)}`);
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
  // 価格系列は日次グリッド (#137)。週次グリッドは金曜の値だけを拾うため週内の動きが消える。
  for (const view of DAILY_VIEWS) {
    writeView(`${view}-daily`, buildDailyView({ observations, config: appConfig, start, today: now }, view));
  }
  // 月次指標は週次グリッドに載せない (#64)。別ビューとして持つ。
  writeView('economy', buildEconomyView({ observations, config: appConfig, start, today: now }));
  writeView(
    'drawdown',
    buildDrawdownView({
      observations,
      config: appConfig,
      start,
      today: now,
      seed: drawdownSeed,
      assets: DRAWDOWN_ASSETS,
      names: Object.fromEntries(
        Object.entries(indicators).map(([id, indicator]) => [id, indicator.name]),
      ),
    }),
  );
  // High Tight Flag (#231)。指標マスタを経由しない (#229 と同じ理由、ADR-0008)。
  writeView(
    'high-tight-flag',
    buildHighTightFlagView({
      symbols: TIINGO_ASSETS,
      ohlcvObservations: Object.fromEntries(
        TIINGO_SYMBOLS.map((symbol) => [symbol, readOhlcvObservations(symbol)]),
      ),
      generatedAt: now.toISOString(),
    }),
  );

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
