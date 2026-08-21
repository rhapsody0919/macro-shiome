/**
 * Tiingo アダプタ (#229、ADR-0008)。
 *
 * ETF の日足 OHLCV (高値・安値を含む) を取る。カップウィズハンドル・ブルフラッグ
 * (#230 #231) の判定に高値・安値が要るが、Finnhub の `stock/candle` (日次ヒストリカル)
 * は無料枠で 403 (#136)。無登録の Stooq / Yahoo Finance は実機でどちらも自動化不可を
 * 確認済み。Tiingo が唯一の無料経路になる。
 *
 * **API キーはエラーにも出さない。** 公開リポジトリで Actions のログは誰でも読めるため、
 * URL をそのまま例外に載せるとキーが漏れる (FRED / Finnhub アダプタと同じ配慮)。
 *
 * **調整済み価格 (`adj*`) を使う。** 生の価格は株式分割で不連続にジャンプし、
 * パターン判定の深さ・期間を誤らせる。
 *
 * `TiingoClient` のレート制限・リトライ (`waitForSlot`/`safeUrlLabel`/指数
 * バックオフ) は `FinnhubClient` (`finnhub.ts`) とほぼ同型。共通化も検討したが、
 * 現状はレート制限付きアダプタが 2 つだけで、抽象化の複雑さに見合わないと判断した
 * (KISS/YAGNI)。3 つ目が増えたら `RateLimitedClient` 基底クラスへの切り出しを検討する。
 */

import type { OhlcvBar } from '../data/types';

const BASE_URL = 'https://api.tiingo.com/tiingo/daily';

/** 例外に載せて安全な URL。**トークンを含めない**。 */
function safeUrlLabel(symbol: string, startDate: string): string {
  return `${BASE_URL}/${symbol}/prices?startDate=${startDate}`;
}

interface EodBarResponse {
  date?: unknown;
  adjOpen?: unknown;
  adjHigh?: unknown;
  adjLow?: unknown;
  adjClose?: unknown;
  adjVolume?: unknown;
}

export interface TiingoClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** 連続呼び出しの最小間隔 (ms)。無料枠は 1 時間 50 件が上限。 */
  intervalMs?: number;
}

export class TiingoClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly intervalMs: number;
  private lastRequestAt = 0;

  constructor(options: TiingoClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = options.maxRetries ?? 2;
    // 無料枠は 1 時間 50 件。45 件/時間相当まで抑えて安全マージンを持たせる (ADR-0008)。
    this.intervalMs = options.intervalMs ?? Math.ceil(3_600_000 / 45);
  }

  /**
   * `sinceDate` 以降の日足バーをまとめて返す。**空配列は失敗として扱う** (throw する)。
   *
   * 1 回のリクエストで複数日分を取れるため、直近数日分をまとめて要求する。
   * バッチが数日止まっていても UPSERT (`upsertOhlcvObservations`) で自動的に埋まり、
   * 週末を挟んでも平日分が必ず含まれる (#125 の「値が指す日」の教訓、Tiingo は
   * 日付を返すため Finnhub のような `lastClosedTradingDay` の自前計算が不要)。
   *
   * **不正な日は個別にスキップし、有効な日だけ返す。** 薄商いの ETF (対象36本には
   * SMIN/VNM/EIDO/THD 等の単一国 ETF が含まれる) で 1 日だけ出来高 0 のような
   * 不正値が混ざっても、`Array.map` で一括パースすると 1 件の不正が直近10日分
   * すべてを握りつぶしてしまう。日ごとに独立してパースし、被害を該当日だけに
   * とどめる。
   */
  async fetchRecentBars(symbol: string, sinceDate: string): Promise<ParseOhlcvBarsResult> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await this.sleep(this.intervalMs * 2 ** attempt);
      await this.waitForSlot();

      let response: Response;
      try {
        response = await this.fetchImpl(
          `${BASE_URL}/${encodeURIComponent(symbol)}/prices?startDate=${sinceDate}&token=${this.apiKey}`,
        );
      } catch (cause) {
        if (attempt === this.maxRetries) {
          throw new Error(
            `Tiingo への接続に失敗 (${safeUrlLabel(symbol, sinceDate)}): ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
        continue;
      }

      if (response.ok) return parseOhlcvBars(await response.json(), symbol);

      // 429 (レート上限超過) は 4xx 全般より先に判定する。**リトライを使い切った
      // 後も専用メッセージにする**。そうしないと下の「4xx 全般」に落ちて
      // 「API キーか symbol を確認する」という実際の原因と違うメッセージになる。
      if (response.status === 429) {
        if (attempt < this.maxRetries) continue;
        throw new Error(
          `Tiingo が 429 (レート制限超過) を返した (${safeUrlLabel(symbol, sinceDate)})。` +
            '無料枠 (1 時間 50 件) を使い切っている可能性がある',
        );
      }

      // 4xx は再試行しても直らない。キーの誤りか存在しない symbol。
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Tiingo が ${response.status} を返した (${safeUrlLabel(symbol, sinceDate)})。API キーか symbol を確認する`,
        );
      }
      if (attempt === this.maxRetries) {
        throw new Error(`Tiingo が ${response.status} を返した (${safeUrlLabel(symbol, sinceDate)})`);
      }
    }
    throw new Error(`Tiingo の取得に失敗 (${safeUrlLabel(symbol, sinceDate)})`);
  }

  /** 呼び出し間隔を空ける。相手の上限に当てないため。 */
  private async waitForSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.intervalMs) await this.sleep(this.intervalMs - elapsed);
    this.lastRequestAt = Date.now();
  }
}

export interface ParseOhlcvBarsResult {
  bars: Array<{ date: string; bar: OhlcvBar }>;
  /** パースに失敗して除外した日。呼び出し元で failures に積む。 */
  skipped: Array<{ date: string; reason: string }>;
}

/**
 * 応答から日足バーの配列を取り出す。
 *
 * **配列全体が空なら失敗として扱う** (throw する)。存在しないシンボルでも 200 と
 * `[]` を返すことがあるため、「取得したが 0 件」を正常として静かに通すと、
 * シンボルの誤りに気付けなくなる。
 *
 * **個々のバーの不正は日単位でスキップし、有効な日は返す。** 薄商いの ETF
 * (対象36本には SMIN/VNM/EIDO/THD 等の単一国 ETF を含む) で 1 日だけ不正値が
 * 混ざっても、一括で例外にすると直近10日分すべてが失われる。
 */
export function parseOhlcvBars(body: unknown, symbol: string): ParseOhlcvBarsResult {
  if (!Array.isArray(body)) {
    throw new Error(`Tiingo: 応答が配列でない (${symbol})`);
  }
  if (body.length === 0) {
    throw new Error(`Tiingo: 応答が空 (${symbol})。symbol の誤りか、対象期間に取引が無い`);
  }
  const bars: Array<{ date: string; bar: OhlcvBar }> = [];
  const skipped: Array<{ date: string; reason: string }> = [];
  body.forEach((entry, index) => {
    try {
      bars.push(parseBar(entry, symbol));
    } catch (error) {
      skipped.push({
        date: extractRawDate(entry) ?? `(${index} 件目、日付不明)`,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });
  return { bars, skipped };
}

function extractRawDate(entry: unknown): string | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined;
  const date = (entry as EodBarResponse).date;
  return typeof date === 'string' ? date.slice(0, 10) : undefined;
}

function parseBar(entry: unknown, symbol: string): { date: string; bar: OhlcvBar } {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`Tiingo: バーがオブジェクトでない (${symbol})`);
  }
  const record = entry as EodBarResponse;
  const date = typeof record.date === 'string' ? record.date.slice(0, 10) : undefined;
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Tiingo: 日付が不正 (${symbol}: ${String(record.date)})`);
  }
  const fields = {
    open: record.adjOpen,
    high: record.adjHigh,
    low: record.adjLow,
    close: record.adjClose,
    volume: record.adjVolume,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Tiingo: ${key} が数値でない (${symbol} ${date}: ${String(value)})`);
    }
    if (value <= 0) {
      throw new Error(`Tiingo: ${key} が 0 以下 (${symbol} ${date})`);
    }
  }
  return {
    date,
    bar: {
      open: fields.open as number,
      high: fields.high as number,
      low: fields.low as number,
      close: fields.close as number,
      volume: fields.volume as number,
    },
  };
}

export function readTiingoApiKeyFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const key = env.TIINGO_API_KEY;
  if (key === undefined || key.length === 0) {
    throw new Error(
      '環境変数 TIINGO_API_KEY が未設定。GitHub Actions Secrets に登録し、ワークフローから渡す',
    );
  }
  return key;
}
