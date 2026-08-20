// 使い捨て。FRED の系列ページから単位を取れるか確かめる (#212)。
async function main(): Promise<void> {
  const url = 'https://fred.stlouisfed.org/series/TCU';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'macro-shiome-verify' } });
      const body = await res.text();
      const i = body.indexOf('Units');
      console.log(`試行 ${attempt}: HTTP ${res.status} ${body.length} bytes Units=${i}`);
      if (i >= 0) {
        console.log(`周辺 ${JSON.stringify(body.slice(i - 150, i + 500))}`);
        return;
      }
      console.log(`先頭 ${JSON.stringify(body.slice(0, 300))}`);
    } catch (error) {
      console.log(`試行 ${attempt}: 失敗 ${String(error)}`);
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}
void main();
