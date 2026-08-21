// 使い捨て。BSI 3 系列が指標マスタ経由で取れるか確かめる。**鍵は出力しない**。
import { indicators } from '../src/lib/data/indicators';
import { EstatClient, readEstatAppIdFromEnv } from '../src/lib/adapters/estat-api';

async function main(): Promise<void> {
  const client = new EstatClient({ appId: readEstatAppIdFromEnv() });
  for (const id of ['jp-bsi-large', 'jp-bsi-mid', 'jp-bsi-small']) {
    const source = indicators[id].source;
    if (source.adapter !== 'estat-api') continue;
    try {
      const o = await client.fetchTable(source);
      const ks = Object.keys(o).sort();
      console.log(`  ${id.padEnd(14)} ${ks.length} 点  ${ks[0]} 〜 ${ks[ks.length - 1]}  最新 ${o[ks[ks.length - 1]]}`);
    } catch (error) {
      console.log(`  ${id}: 失敗 ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
void main();
