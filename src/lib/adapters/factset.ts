/**
 * FactSet Earnings Insight 週次 PDF アダプタ。
 *
 * 抽出はすべて **本文テキスト層** から行う。PDF の p.31-32 には EPS の実数がグラフ画像の
 * データラベルとして載っているが、OCR は採用しない (tesseract は 300/600dpi とも誤読し、
 * 89.20 → 69.20 のような silent な誤りが蓄積するため。spec 3 節)。
 *
 * 休刊週が実在する (2026 年は 8/14・8/21、2023 年は 8/11 以降、2022 年 8 月)。
 * URL に日付が入るため休刊週は 404 になる。これは異常ではなく欠測として扱う。
 */
import type { FactsetField } from '../data/types';

const BASE_URL =
  'https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_';

/** 抽出結果。取得できなかった項目は欠測として null にする。 */
export type FactsetExtract = Partial<Record<FactsetField, number>>;

export class FactsetNotPublishedError extends Error {
  constructor(readonly url: string) {
    super(`FactSet レポートが公開されていない (休刊週の可能性): ${url}`);
    this.name = 'FactsetNotPublishedError';
  }
}

/**
 * レポートの URL を組み立てる。ファイル名は MMDDYY 形式。
 * FactSet は金曜発行なので、金曜以外を渡すのは呼び出し側の誤りとして弾く。
 */
export function factsetPdfUrl(date: Date): string {
  if (date.getUTCDay() !== 5) {
    throw new Error(
      `FactSet は金曜発行。金曜以外の日付が渡された: ${date.toISOString().slice(0, 10)}`,
    );
  }
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(2);
  return `${BASE_URL}${mm}${dd}${yy}.pdf`;
}

/** 指定日以前で直近の金曜日 (指定日が金曜ならその日) を返す。 */
export function previousFriday(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // 金曜 = 5。差分は 0〜6 日。
  const diff = (result.getUTCDay() - 5 + 7) % 7;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

/** 指定日より後で直近の金曜日 (#270、発表予定カレンダーの既定値に使う)。 */
export function nextFriday(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const diff = (5 - result.getUTCDay() + 7) % 7 || 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * 休刊予告 (Author's Note) から次回発行日を取り出す (#270)。
 *
 * FactSet は毎週金曜発行が基本で、休刊週があるときだけ本文冒頭に
 * "Author's Note: The FactSet Earnings Insight report will not be published on
 * [日付]. The next edition of the report will be published on [日付]." という
 * 一貫した書式で予告を載せる (2026-08-07 号で確認)。**通常週はこの文言が無い**ため、
 * 見つからなければ null を返し、呼び出し側は `nextFriday` を既定値として使う。
 *
 * 年はレポート自体の発行日から推定する。予告の月がレポートの発行月より前なら
 * 年をまたぐとみなし +1 する (12月号が1月の予定を予告するケース)。
 */
export function parseFactsetNextIssueDate(text: string, reportDate: Date): string | null {
  const flat = text.replace(/\s+/g, ' ');
  const match = flat.match(
    /next edition of the report will be published on ([A-Z][a-z]+) (\d{1,2})/i,
  );
  if (match === null) return null;

  const monthIndex = MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === match[1].toLowerCase(),
  );
  if (monthIndex === -1) {
    throw new Error(`FactSet: 次回発行予告の月名を解釈できない (${match[1]})`);
  }
  const day = Number.parseInt(match[2], 10);

  const reportYear = reportDate.getUTCFullYear();
  const reportMonth = reportDate.getUTCMonth();
  const year = monthIndex < reportMonth ? reportYear + 1 : reportYear;

  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 数値を取り出す。
 *
 * 同じ指標はレポート内の複数箇所 (サマリーと本文) に現れるため、複数ヒットは正常。
 * ただし **値が食い違う場合は失敗**にする。別の指標に当たっているか文言が変わった証拠であり、
 * 黙って先頭を採ると誤った値が蓄積するため。
 */
function extractOne(text: string, pattern: RegExp, label: string): number | undefined {
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return undefined;

  const values = matches.map((m) => Number.parseFloat(m[1]));
  for (const [i, value] of values.entries()) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label}: 数値として解釈できない (${matches[i][1]})`);
    }
  }

  const unique = [...new Set(values)];
  if (unique.length > 1) {
    throw new Error(
      `${label}: 値が食い違う箇所が複数ある (${unique.join(', ')})。PDF の文言が変わった可能性がある`,
    );
  }
  return unique[0];
}

/**
 * forward / trailing それぞれの P/E に対応する 5 年・10 年平均を取り出す。
 *
 * 号によって書き方が 2 通りある。
 * - 同一文: 「The forward 12-month P/E ratio is 20.0, which is above the 5-year average (19.9)...」
 * - 次の文: 「The forward 12-month P/E ratio for the S&P 500 is 20.0. This P/E ratio is above the 5-year average of 19.9...」
 *
 * そのためアンカーを含む文と、その次の文までを対象にする。
 * ただし次の文が他方 (trailing / forward) のアンカーを含む場合は、取り違えを避けるため結合しない。
 */
function findAverages(
  sentences: readonly string[],
  kind: 'forward' | 'trailing',
): { avg5?: number; avg10?: number } {
  const anchor = new RegExp(`${kind} 12-month P/E ratio`, 'i');
  const otherAnchor = new RegExp(`${kind === 'forward' ? 'trailing' : 'forward'} 12-month P/E ratio`, 'i');

  for (const [i, sentence] of sentences.entries()) {
    if (!anchor.test(sentence)) continue;

    const next = sentences[i + 1];
    const scope =
      next !== undefined && !otherAnchor.test(next) ? `${sentence} ${next}` : sentence;

    const avg5 = extractOne(scope, /5-year average (?:\(|of )(\d+(?:\.\d+)?)/gi, `${kind}Pe5yAvg`);
    const avg10 = extractOne(scope, /10-year average (?:\(|of )(\d+(?:\.\d+)?)/gi, `${kind}Pe10yAvg`);
    if (avg5 !== undefined || avg10 !== undefined) {
      return { avg5, avg10 };
    }
  }
  return {};
}

/**
 * PDF 本文テキストから各項目を抽出する。
 *
 * 正規表現は 2026-08-07 号の実際の記述に合わせている。forward は平均値が括弧書き
 * ("the 5-year average (19.9)")、trailing は of 表記 ("the 5-year average of 24.4") と
 * 書き分けられているため、両方を許容する。
 */
export function parseFactsetText(text: string): FactsetExtract {
  // 改行や連続空白を 1 つに潰す。PDF 抽出では文が行で分断されるため。
  const flat = text.replace(/\s+/g, ' ');

  const result: FactsetExtract = {};

  const forwardPe = extractOne(
    flat,
    /forward 12-month P\/E ratio (?:for the S&P 500 )?is (\d+(?:\.\d+)?)/gi,
    'forwardPe',
  );
  if (forwardPe !== undefined) result.forwardPe = forwardPe;

  const trailingPe = extractOne(
    flat,
    /trailing 12-month P\/E ratio (?:for the S&P 500 )?is (\d+(?:\.\d+)?)/gi,
    'trailingPe',
  );
  if (trailingPe !== undefined) result.trailingPe = trailingPe;

  // 平均値は forward / trailing を取り違えないよう、それぞれのアンカー周辺から取る。
  const sentences = flat.split(/(?<=\.)\s+/);

  const forwardAvg = findAverages(sentences, 'forward');
  if (forwardAvg.avg5 !== undefined) result.forwardPe5yAvg = forwardAvg.avg5;
  if (forwardAvg.avg10 !== undefined) result.forwardPe10yAvg = forwardAvg.avg10;

  const trailingAvg = findAverages(sentences, 'trailing');
  if (trailingAvg.avg5 !== undefined) result.trailingPe5yAvg = trailingAvg.avg5;
  if (trailingAvg.avg10 !== undefined) result.trailingPe10yAvg = trailingAvg.avg10;

  // PER と同一時点の終値。EPS の逆算に使うことで時点ズレを避ける。
  const close = extractOne(flat, /closing price of (\d+(?:\.\d+)?)/gi, 'closePrice');
  if (close !== undefined) result.closePrice = close;

  // 進行中四半期の blended 増益率。今週 / 先週 / 四半期末の 3 時点が 1 文に並ぶ。
  //
  // 括弧内の注釈は号によって変わる。2026-08-07 号は
  // 「blended (combines actual results for companies that have reported and estimated results
  // for companies that have yet to report) earnings growth rate...」だが、
  // 「blended (year-over-year) earnings growth rate...」と短い号もあるため中身は問わない。
  //
  // 売上側 (revenue growth rate) が同じ構造で書かれているので、earnings を明示して取り違えを防ぐ。
  const blended = flat.match(
    /blended(?:\s*\([^)]*\))?\s+earnings growth rate for the [a-z]+ quarter is (-?\d+(?:\.\d+)?)% today, compared to an earnings growth rate of (-?\d+(?:\.\d+)?)% last week and an earnings growth rate of (-?\d+(?:\.\d+)?)% at the end of the/i,
  );
  if (blended) {
    result.blendedGrowthToday = Number.parseFloat(blended[1]);
    result.blendedGrowthLastWeek = Number.parseFloat(blended[2]);
    result.blendedGrowthQuarterEnd = Number.parseFloat(blended[3]);
  }

  // 次期・翌々期の予想増益率。"For Q3 2026 and Q4 2026, analysts are calling for
  // earnings growth rates of 27.4% and 25.2%."
  const quarters = flat.match(
    /For Q\d \d{4} and Q\d \d{4}, analysts are calling for earnings growth rates of (-?\d+(?:\.\d+)?)% and (-?\d+(?:\.\d+)?)%/i,
  );
  if (quarters) {
    result.growthNextQuarter = Number.parseFloat(quarters[1]);
    result.growthQuarterAfterNext = Number.parseFloat(quarters[2]);
  }

  // 暦年の予想増益率。年は観測日から決まるため、値だけを取る。
  const calendarYears = [
    ...flat.matchAll(
      /For CY (\d{4}), analysts are projecting earnings growth of (-?\d+(?:\.\d+)?)%/gi,
    ),
  ];
  const sorted = calendarYears
    .map((m) => ({ year: Number.parseInt(m[1], 10), value: Number.parseFloat(m[2]) }))
    .sort((a, b) => a.year - b.year);
  if (sorted.length >= 1) result.growthCurrentCalendarYear = sorted[0].value;
  if (sorted.length >= 2) result.growthNextCalendarYear = sorted[1].value;

  return result;
}

/** PDF のバイト列からテキストを抽出する。 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  // Node 環境で動かすため legacy ビルドを使う (DOM API に依存しない)。
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // 後始末は loadingTask 側で行う (PDFDocumentProxy に destroy は無い)。
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: false });

  try {
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return pages.join('\n');
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * 指定週のレポートを取得して抽出する。
 * 404 は休刊週として `FactsetNotPublishedError` を投げる (呼び出し側で欠測に変換する)。
 */
export async function fetchFactsetReport(friday: Date): Promise<FactsetExtract> {
  const url = factsetPdfUrl(friday);
  const response = await fetch(url);

  if (response.status === 404) {
    throw new FactsetNotPublishedError(url);
  }
  if (!response.ok) {
    throw new Error(`FactSet PDF の取得に失敗 (HTTP ${response.status}): ${url}`);
  }

  const text = await extractPdfText(new Uint8Array(await response.arrayBuffer()));
  return parseFactsetText(text);
}

/** 直近で取得できた号を新しい順に何週まで遡るか (#270)。 */
const NEXT_ISSUE_LOOKBACK_WEEKS = 8;

/**
 * 次回発行予定日を求める (#270)。
 *
 * **休刊週が連続すると、当該週の号は 404 で予告文が読めない。** 例えば
 * 8/14・8/21 が休刊で 8/7 号に予告があった場合、8/21 時点で調べても 8/21 号は
 * 存在しないため、直近で実際に取得できた号 (8/7 号) まで遡って予告を探す必要がある。
 *
 * 見つかった最新号に予告が無ければ (通常号)、次の金曜日を既定値として使う。
 * `NEXT_ISSUE_LOOKBACK_WEEKS` 週たどっても 1 号も取得できなければ null (「不明」表示)。
 */
export async function resolveFactsetNextIssueDate(
  now: Date,
  fetchImpl: typeof fetch = fetch,
  extractText: (data: Uint8Array) => Promise<string> = extractPdfText,
): Promise<string | null> {
  const friday = previousFriday(now);

  for (let i = 0; i < NEXT_ISSUE_LOOKBACK_WEEKS; i++) {
    const candidate = new Date(friday);
    candidate.setUTCDate(candidate.getUTCDate() - i * 7);
    const url = factsetPdfUrl(candidate);

    let response: Response;
    try {
      response = await fetchImpl(url);
    } catch {
      continue; // ネットワークエラーはこの号を諦めてもう1週遡る。
    }
    if (!response.ok) continue; // 休刊週。もう1週遡る。

    const text = await extractText(new Uint8Array(await response.arrayBuffer()));
    const announced = parseFactsetNextIssueDate(text, candidate);
    const todayIso = now.toISOString().slice(0, 10);
    if (announced !== null && announced >= todayIso) return announced;

    // 予告が無い、または予告が既に過去の日付 (読み終えた古い号) → 通常どおり次の金曜日。
    return nextFriday(now).toISOString().slice(0, 10);
  }

  return null;
}
