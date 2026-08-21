// 使い捨て。現行の BSI 表を特定する。**鍵は出力しない**。
async function main(): Promise<void> {
  const appId = process.env.ESTAT_APP_ID ?? '';
  for (const id of ['0003200132', '0003326000']) {
    const params = new URLSearchParams({
      appId, statsDataId: id,
      cdCat01: '10', cdCat02: '20', cdCat03: '50', cdCat04: '10',
      limit: '3',
    });
    const body = (await (
      await fetch(`https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params}`)
    ).json()) as Record<string, any>;
    const inf = body?.GET_STATS_DATA?.STATISTICAL_DATA;
    const values = inf?.DATA_INF?.VALUE;
    const rows = Array.isArray(values) ? values : values ? [values] : [];
    const objs = inf?.CLASS_INF?.CLASS_OBJ ?? [];
    const axes = (Array.isArray(objs) ? objs : [objs]).map((o: any) => `${o?.['@id']}(${o?.['@name']})`);
    let range = '';
    for (const o of Array.isArray(objs) ? objs : [objs]) {
      if (o?.['@id'] !== 'time') continue;
      const cls = Array.isArray(o.CLASS) ? o.CLASS : [o.CLASS];
      range = `${cls[cls.length - 1]?.['@name']} 〜 ${cls[0]?.['@name']} (${cls.length} 期)`;
    }
    console.log(`\n[${id}] 総数 ${inf?.RESULT_INF?.TOTAL_NUMBER} / ${range}`);
    console.log(`  軸: ${axes.join(', ')}`);
    for (const r of rows) console.log(`  ${JSON.stringify(r)}`);
  }
}
void main();
