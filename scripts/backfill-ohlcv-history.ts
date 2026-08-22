/**
 * Tiingo から ETF 36 本の日足 OHLCV 履歴をバックフィルする (#249)。
 *
 * **one-shot スクリプト。** 定期取得 (`fetch-daily.ts`) は既存観測の最新日から
 * 取り直す設計のまま変えない (#249 のバックフィルは初期蓄積のためだけに使う)。
 *
 * カップウィズハンドル (#230、カップ最大65週+ハンドル4週) / High Tight Flag
 * (#231、ポール8週+フラッグ5週) の判定に必要な期間分を一度に取り込む。
 *
 * ADR-0008 は「遡及データを一度に大量取得すると 1 時間 50 件の制限にすぐ達する」
 * としてバックフィルを見送っていたが、この判断は誤りだった。実機で確認したところ
 * `startDate` を過去に指定した **1 リクエストで複数年分が一括で返る**
 * (SPY で `startDate=2020-01-01` → 1,668 件が 1 レスポンスに収まった)。
 * 1 銘柄 = 1 リクエストなので、36 銘柄でも 36 リクエストで完結し、無料枠
 * (1 時間 50 件) に余裕で収まる (#237 で訂正した「1 時間 50 件はカウント上限で
 * あり瞬間レートではない」という教訓と同じ型の誤解釈だった)。
 *
 * 実行:
 *   pnpm tsx scripts/backfill-ohlcv-history.ts [--since=YYYY-MM-DD]
 *   (--since 省略時は 2 年前。カップウィズハンドルの最大 69 週に余裕を持たせた値)
 */
import { TiingoClient, readTiingoApiKeyFromEnv } from '../src/lib/adapters/tiingo';
import { TIINGO_SYMBOLS } from '../src/lib/data/tiingo-assets';
import { readOhlcvObservations, upsertOhlcvObservations } from '../src/lib/data/store';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultSinceDate(now: Date): string {
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);
  return twoYearsAgo.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const now = new Date();
  const sinceArg = process.argv.slice(2).find((arg) => arg.startsWith('--since='));
  const sinceDate = sinceArg?.slice('--since='.length) ?? defaultSinceDate(now);

  const tiingo = new TiingoClient({ apiKey: readTiingoApiKeyFromEnv() });
  const failures: string[] = [];

  for (const symbol of TIINGO_SYMBOLS) {
    const before = Object.keys(readOhlcvObservations(symbol)).length;
    try {
      const { bars, skipped } = await tiingo.fetchRecentBars(symbol, sinceDate);
      const observations = Object.fromEntries(bars.map(({ date, bar }) => [date, bar]));
      const after = Object.keys(upsertOhlcvObservations(symbol, observations, now)).length;
      for (const { date, reason } of skipped) {
        failures.push(`${symbol} @${date}: ${reason}`);
      }
      const dates = Object.keys(observations).sort();
      console.log(`${symbol}: ${before} 点 → ${after} 点 / ${dates[0]} 〜 ${dates.at(-1)}`);
    } catch (error) {
      failures.push(`${symbol}: ${message(error)}`);
      console.error(`${symbol}: 失敗 (${message(error)})`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} 件、一部の日をスキップまたは失敗:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  }
}

void main();
