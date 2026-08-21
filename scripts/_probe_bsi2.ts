// 使い捨て。BSI の実データ (日付形式・軸の値) を確かめる。**鍵は出力しない**。
async function main(): Promise<void> {
  const appId = process.env.ESTAT_APP_ID ?? '';
  const params = new URLSearchParams({
    appId,
    statsDataId: '0003200132',
    cdCat01: '10', // 当期
    cdCat02: '20', // 大企業
    cdCat03: '50', // BSI
    cdCat04: '10', // 全産業
    limit: '6',
  });
  const body = (await (
    await fetch(`https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params}`)
  ).json()) as Record<string, any>;
  const inf = body?.GET_STATS_DATA?.STATISTICAL_DATA;
  console.log('  結果コード:', body?.GET_STATS_DATA?.RESULT?.STATUS, body?.GET_STATS_DATA?.RESULT?.ERROR_MSG);
  console.log('  総数:', inf?.RESULT_INF?.TOTAL_NUMBER);
  const values = inf?.DATA_INF?.VALUE;
  const rows = Array.isArray(values) ? values : values ? [values] : [];
  console.log(`  返却 ${rows.length} 行`);
  for (const r of rows) console.log('   ', JSON.stringify(r));
  // 時間軸の値も見る
  const objs = inf?.CLASS_INF?.CLASS_OBJ ?? [];
  for (const o of Array.isArray(objs) ? objs : [objs]) {
    if (o?.['@id'] !== 'time') continue;
    const cls = Array.isArray(o.CLASS) ? o.CLASS : [o.CLASS];
    console.log(`  時間軸 ${cls.length} 値 (先頭と末尾):`);
    for (const c of [cls[0], cls[cls.length - 1]]) console.log(`    ${c?.['@code']} ${c?.['@name']}`);
  }
}
void main();
