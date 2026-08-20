// 使い捨て。FRED の単位をキー無しで取れる経路を探す (#212)。
const ID = 'TCU';
const urls = [
  `https://fred.stlouisfed.org/data/${ID}.txt`,
  `https://fred.stlouisfed.org/series/${ID}`,
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ID}`,
  `https://fred.stlouisfed.org/data/${ID}`,
];
for (const url of urls) {
  try {
    const res = await fetch(url);
    const body = await res.text();
    const i = body.indexOf('Units');
    console.log(`\n=== ${url}`);
    console.log(`   HTTP ${res.status}  ${body.length} bytes  Units の位置=${i}`);
    if (i >= 0) console.log(`   周辺: ${JSON.stringify(body.slice(i - 80, i + 320))}`);
    else console.log(`   先頭: ${JSON.stringify(body.slice(0, 200))}`);
  } catch (error) {
    console.log(`\n=== ${url}\n   失敗 ${String(error)}`);
  }
}
