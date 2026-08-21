// 使い捨て。#224 の閾値を実測で決める。**鍵は出力しない**。
import { readFileSync } from 'node:fs';
import { indicators } from '../src/lib/data/indicators';
import { FinnhubClient, readFinnhubApiKeyFromEnv } from '../src/lib/adapters/finnhub';

async function main(): Promise<void> {
  const view = JSON.parse(readFileSync('data/views/drawdown.json', 'utf8')) as {
    assets: Array<{ id: string; name: string; high: number | null }>;
  };
  const client = new FinnhubClient({ apiKey: readFinnhubApiKeyFromEnv() });
  const rows: Array<{ id: string; stored: number; high: number; gap: number; date: string }> = [];
  for (const asset of view.assets) {
    const indicator = indicators[asset.id];
    if (asset.high === null || indicator?.source.adapter !== 'finnhub') continue;
    try {
      const { high, date } = await client.fetch52WeekHigh(indicator.source.symbol);
      rows.push({ id: asset.id, stored: asset.high, high, gap: ((high - asset.high) / high) * 100, date });
    } catch (error) {
      console.log(`  ${asset.id}: 取得に失敗 (${error instanceof Error ? error.message : 'unknown'})`);
    }
  }
  rows.sort((a, b) => b.gap - a.gap);
  console.log(`\n照合 ${rows.length} 本  (gap = 52週高値に対して積み上げ値が何 % 低いか)`);
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(10)} 積み上げ ${r.stored.toFixed(2).padStart(9)} / 52週 ${r.high.toFixed(2).padStart(9)} (${r.date})  gap ${r.gap.toFixed(2)}%`,
    );
  }
}
void main();
