/**
 * Stock Bot (GAS + スプレッドシート) の履歴を取り込む (#128)。
 *
 * **一度だけ実行して結果をコミットする。** ETF の過去価格は無料で取れないため、
 * この履歴は**再生成できない**。生成物 `data/seed/stock-bot-drawdown.json` は
 * 取得層が作る `data/observations/` とは別に置き、由来が分かるようにする。
 *
 * 実行:
 *   pnpm tsx scripts/import-stock-bot.ts \
 *     --history /tmp/stock-bot-history.csv \
 *     --highs /tmp/'Stock Bot - MainETFData.csv' /tmp/'Stock Bot - SectorETFData.csv'
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { indicators } from '../src/lib/data/indicators';

/** 引き継がない銘柄と、その理由。画面の注記にも出す。 */
const EXCLUDED: Record<string, string> = {
  // Finnhub が c=0 を返し、GAS の履歴も 2025-11-22 で途切れている (#131)。
  // ティッカーが機能していないため対象から外した。指標マスタからも削除済み。
  GXG: 'ティッカーが機能していないため (#131)',
  // 2026-04-21 に 0.0 → 87.4 へ跳ね、以降 85% 前後で固定。同時期の QQQ は 3.8% で整合しない。
  // 誤った高値を掴んだまま Math.max で単調増加し、GAS 側では復旧できていない。
  VGT: '2026-04-21 に異常値を掴み最高値が固定されたため',
};

interface Args {
  history: string;
  highs: string[];
}

function parseArgs(argv: readonly string[]): Args {
  const history = argv[argv.indexOf('--history') + 1];
  const at = argv.indexOf('--highs');
  const highs = at === -1 ? [] : argv.slice(at + 1).filter((v) => !v.startsWith('--'));
  if (history === undefined || highs.length === 0) {
    throw new Error('--history と --highs を指定する');
  }
  return { history, highs };
}

/** CSV を行 × 列に割る。値に , を含む列は無いので単純分割で足りる。 */
function readCsv(path: string): string[][] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

/** "2024/11/29" と "2024-11-29" の両方を受ける。 */
function toIso(value: string): string | null {
  const m = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m === null) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** シンボル → 最高値。MainETFData / SectorETFData の 3 列目。 */
function readHighs(paths: readonly string[]): Record<string, number> {
  const highs: Record<string, number> = {};
  for (const path of paths) {
    for (const row of readCsv(path).slice(1)) {
      const [, symbol, high] = row;
      if (symbol === undefined || symbol === '') continue;
      const value = Number(high);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`最高値が数値でない (${symbol}: ${String(high)})`);
      }
      highs[symbol] = value;
    }
  }
  return highs;
}

/**
 * 0 付近から高い下落率へ跳ぶ箇所を探す (#128)。
 *
 * **最高値が誤った値で固定された痕跡**。逆向き (高い値 → 0) は最高値の更新なので正常。
 *
 * しきい値 20pt は日次で取り込んでも据え置ける (#138)。CSV 全 626 行を実測したところ、
 * 1 日の下落率悪化は次のように分かれた。
 *
 * - **VGT 87.40pt** (2026-04-21) — 汚染。これだけが突出している
 * - 実在の市場変動の最大は **USO 16.06pt** (2026-04-08)、次いで UNG 15.31 / VDE 14.74
 *
 * 20pt は両者の間にあり、約 4pt の余裕がある。
 */
function findCorruption(series: Array<[string, number]>): string | null {
  for (let i = 1; i < series.length; i++) {
    const [, before] = series[i - 1];
    const [date, after] = series[i];
    if (after - before >= 20) return date;
  }
  return null;
}

function main(): void {
  const { history, highs: highPaths } = parseArgs(process.argv.slice(2));
  const highs = readHighs(highPaths);

  const rows = readCsv(history);
  const header = rows[0];
  const bySymbol: Record<string, Array<[string, number]>> = {};

  for (const row of rows.slice(1)) {
    const iso = toIso(row[0] ?? '');
    if (iso === null) continue;
    for (let col = 1; col < header.length; col++) {
      const symbol = header[col];
      const raw = row[col];
      if (symbol === undefined || raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100) continue;
      (bySymbol[symbol] ??= []).push([iso, value]);
    }
  }

  // 指標マスタに登録済みの ETF だけを対象にする。
  const wanted = new Map<string, string>();
  for (const [id, indicator] of Object.entries(indicators)) {
    if (indicator.source.adapter === 'finnhub') wanted.set(indicator.source.symbol, id);
  }

  const assets: Record<string, { seedHigh: number; drawdown: Record<string, number> }> = {};
  const skipped: string[] = [];

  for (const [symbol, id] of wanted) {
    if (EXCLUDED[symbol] !== undefined) {
      skipped.push(`${symbol}: ${EXCLUDED[symbol]}`);
      continue;
    }
    const series = bySymbol[symbol];
    if (series === undefined || series.length === 0) {
      skipped.push(`${symbol}: 履歴に値が無い`);
      continue;
    }
    const corrupted = findCorruption(series);
    if (corrupted !== null) {
      skipped.push(`${symbol}: ${corrupted} に下落率が 1 日で 20pt 以上悪化 (最高値の汚染を疑う)`);
      continue;
    }
    const seedHigh = highs[symbol];
    if (seedHigh === undefined) {
      skipped.push(`${symbol}: 最高値が見つからない`);
      continue;
    }
    assets[id] = { seedHigh, drawdown: Object.fromEntries(series) };
  }

  const output = {
    source: 'Stock Bot (GAS + Google スプレッドシート)',
    note:
      'ETF の過去価格は無料で取得できないため、下落率の履歴をそのまま引き継いでいる。' +
      '最高値の起点は Stock Bot の観測開始 (2024-11-28) であり、史上最高値ではない。',
    importedAt: new Date().toISOString(),
    assets,
  };
  writeFileSync('data/seed/stock-bot-drawdown.json', `${JSON.stringify(output, null, 2)}\n`);

  const dates = Object.values(assets).flatMap((a) => Object.keys(a.drawdown));
  console.log(`取り込み: ${Object.keys(assets).length} 銘柄 / ${wanted.size} 中`);
  console.log(`期間: ${dates.sort()[0]} 〜 ${dates.sort().at(-1)}`);
  for (const line of skipped) console.log(`  除外 ${line}`);
}

main();
