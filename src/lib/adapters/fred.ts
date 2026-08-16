/**
 * FRED API アダプタ。
 *
 * v1 の指標の大半 (指数・金利・期待インフレ率・VIX・為替) はここから取る。
 * ADR-0004 の狙いどおり、新しい FRED 系指標は `data/indicators.json` に 1 エントリ
 * 足すだけで取得できる (このファイルの変更は不要)。
 *
 * **API キーを絶対にログ・エラーメッセージへ出さない。**
 * public リポジトリの Actions ログは誰でも読めるため、URL をそのまま例外に含めると漏れる。
 */

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

/** FRED は 120 req/min。1 秒間隔なら 60 req/min で収まる。 */
const DEFAULT_INTERVAL_MS = 1000;

export interface FredClientOptions {
  apiKey: string;
  /** テストで差し替えるために注入可能にする。 */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** 5xx / ネットワークエラー時の再試行回数。4xx は再試行しない。 */
  maxRetries?: number;
  intervalMs?: number;
}

export interface FetchSeriesOptions {
  /** "YYYY-MM-DD"。省略すると FRED の提供範囲すべて。 */
  start?: string;
  end?: string;
}

/** 観測値。日付 → 値。欠測 (FRED の ".") は**キーを作らない**。 */
export type Observations = Record<string, number>;

interface FredObservation {
  date: string;
  value: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** URL からクエリを落とす。API キーが載っているのでエラーメッセージにそのまま使えない。 */
function safeUrlLabel(seriesId: string): string {
  return `${BASE_URL}?series_id=${seriesId}`;
}

export class FredClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly intervalMs: number;
  private lastRequestAt = 0;

  constructor(options: FredClientOptions) {
    if (options.apiKey.length === 0) {
      throw new Error('FRED API キーが空。環境変数 FRED_API_KEY を設定する');
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxRetries = options.maxRetries ?? 3;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /** 前回のリクエストから一定時間空ける (レート制限対策)。 */
  private async waitForSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt !== 0 && elapsed < this.intervalMs) {
      await this.sleep(this.intervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  async fetchSeries(seriesId: string, options: FetchSeriesOptions = {}): Promise<Observations> {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
    });
    if (options.start !== undefined) params.set('observation_start', options.start);
    if (options.end !== undefined) params.set('observation_end', options.end);

    const url = `${BASE_URL}?${params.toString()}`;
    const body = await this.requestWithRetry(url, seriesId);
    return parseObservations(body, seriesId);
  }

  private async requestWithRetry(url: string, seriesId: string): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // 指数バックオフ。1 秒 → 2 秒 → 4 秒。
        await this.sleep(this.intervalMs * 2 ** (attempt - 1));
      }
      await this.waitForSlot();

      let response: Response;
      try {
        response = await this.fetchImpl(url);
      } catch (cause) {
        // ネットワークエラー。原因は残すが URL は載せない (API キーが含まれるため)。
        lastError = new Error(
          `FRED への接続に失敗 (${safeUrlLabel(seriesId)}): ${cause instanceof Error ? cause.message : String(cause)}`,
        );
        continue;
      }

      if (response.ok) {
        return await response.json();
      }

      // 4xx は再試行しても直らない。キーの誤りや存在しない series が該当する。
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `FRED が ${response.status} を返した (${safeUrlLabel(seriesId)})。API キーか series_id を確認する`,
        );
      }

      lastError = new Error(`FRED が ${response.status} を返した (${safeUrlLabel(seriesId)})`);
    }

    throw lastError ?? new Error(`FRED の取得に失敗 (${safeUrlLabel(seriesId)})`);
  }
}

/**
 * FRED のレスポンスを観測値に変換する。
 *
 * FRED は欠測を `"."` で返す (市場休場日など)。**キーを作らない**ことで
 * 「取得したが値が無い」と「取得していない」を区別できるようにする (ADR-0004)。
 */
export function parseObservations(body: unknown, seriesId: string): Observations {
  if (typeof body !== 'object' || body === null || !('observations' in body)) {
    throw new Error(`FRED のレスポンスに observations が無い (${seriesId})`);
  }

  const raw = (body as { observations: unknown }).observations;
  if (!Array.isArray(raw)) {
    throw new Error(`FRED の observations が配列でない (${seriesId})`);
  }

  const result: Observations = {};
  for (const item of raw as FredObservation[]) {
    if (typeof item?.date !== 'string' || typeof item?.value !== 'string') {
      throw new Error(`FRED の observation の形式が想定外 (${seriesId}): ${JSON.stringify(item)}`);
    }
    // 欠測はスキップする。0 として扱うと平均や相関が壊れる。
    if (item.value === '.') continue;

    const value = Number.parseFloat(item.value);
    if (!Number.isFinite(value)) {
      throw new Error(`FRED の値が数値でない (${seriesId} ${item.date}): ${item.value}`);
    }
    result[item.date] = value;
  }

  return result;
}

/**
 * 環境変数から API キーを読む。未設定なら実行を止める。
 * 型は `NodeJS.ProcessEnv` ではなく素の辞書にする (NODE_ENV を必須にしないため)。
 */
export function readFredApiKeyFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const key = env.FRED_API_KEY;
  if (key === undefined || key.length === 0) {
    throw new Error(
      '環境変数 FRED_API_KEY が未設定。GitHub Actions Secrets に登録し、ワークフローから渡す',
    );
  }
  return key;
}
