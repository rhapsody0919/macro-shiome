/**
 * ETF の日次終値を履歴ページから遡って取り込む (#135)。
 *
 * **one-shot スクリプト。** 定期取得は Finnhub のまま変えない。
 *
 * 理由: `pnpm verify` の「8. ゴールドの終値と日付の照合」は、この履歴ページを
 * **取得実装と違う経路**として使っている (#133)。定期取得もここに変えると
 * 同じ経路で自己照合することになり、検証が意味を失う。
 *
 * 履歴ページはサーバー側 HTML で**直近 50 営業日**を返す (実測)。期間セレクタは
 * クライアント側 JS なのでクエリでは伸びない。それ以前は取り直せない。
 *
 * 実行:
 *   pnpm tsx scripts/backfill-etf-history.ts GLD [SPY ...]
 *   pnpm tsx scripts/backfill-etf-history.ts --all   # 指標マスタの Finnhub 指標すべて
 */
import { fetchEtfHistory } from '../src/lib/adapters/stockanalysis';
import { indicators } from '../src/lib/data/indicators';
import { readObservations, upsertObservations } from '../src/lib/data/store';

function indicatorIdFor(symbol: string): string {
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter === 'finnhub' && indicator.source.symbol === symbol) return id;
  }
  throw new Error(`指標マスタに ${symbol} の Finnhub 指標が無い`);
}

/** 指標マスタに登録された Finnhub 指標の symbol。 */
function allSymbols(): string[] {
  return Object.values(indicators)
    .filter((indicator) => indicator.source.adapter === 'finnhub')
    .map((indicator) => (indicator.source as { symbol: string }).symbol)
    .sort();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const symbols = args.includes('--all') ? allSymbols() : args;
  if (symbols.length === 0) throw new Error('symbol を 1 つ以上指定するか --all を渡す');

  const now = new Date();
  let first = true;
  for (const symbol of symbols) {
    // 連続で叩かない。FRED の照合 (verify-values.ts) と同じ間隔に合わせる。
    if (!first) await sleep(250);
    first = false;
    const id = indicatorIdFor(symbol);
    const before = Object.keys(readObservations(id)).length;

    const rows = await fetchEtfHistory(symbol);
    const incoming = Object.fromEntries(rows.map((row) => [row.date, row.close]));

    // 既存の値と食い違ったら止める。提供元が違えば末尾が丸められることはあるが、
    // 1 取引日ずれれば桁違いに外れる (#133 の再発検知)。
    const existing = readObservations(id);
    for (const [date, value] of Object.entries(existing)) {
      const fetched = incoming[date];
      if (fetched === undefined) continue;
      if (Math.abs(fetched - value) / Math.max(1, value) > 1e-3) {
        throw new Error(`${id} @${date}: 保存 ${value} / 履歴 ${fetched} が食い違う`);
      }
    }

    const after = Object.keys(upsertObservations(id, incoming, now)).length;
    const dates = Object.keys(incoming).sort();
    console.log(`${symbol} (${id}): ${before} 点 → ${after} 点 / ${dates[0]} 〜 ${dates.at(-1)}`);
  }
}

void main();
