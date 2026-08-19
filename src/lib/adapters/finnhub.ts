/**
 * Finnhub アダプタ (#128)。
 *
 * ETF の現在値を取る。**ETF は FRED に無く**、指数のセクター系列も S&P DJI の
 * 著作権で提供されないため、ここが唯一の無料経路になる。
 *
 * **API キーはエラーにも出さない。** 公開リポジトリで Actions のログは誰でも読めるため、
 * URL をそのまま例外に載せるとキーが漏れる (FRED アダプタと同じ配慮)。
 */

const BASE_URL = 'https://finnhub.io/api/v1/quote';

/** 例外に載せて安全な URL。**トークンを含めない**。 */
function safeUrlLabel(symbol: string): string {
  return `${BASE_URL}?symbol=${symbol}`;
}

interface QuoteResponse {
  /** current price。Finnhub の応答は 1 文字のキー。 */
  c?: unknown;
}

export interface FinnhubClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** 連続呼び出しの最小間隔 (ms)。全プラン共通で 30 calls/秒の上限がある。 */
  intervalMs?: number;
}

export class FinnhubClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly intervalMs: number;
  private lastRequestAt = 0;

  constructor(options: FinnhubClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = options.maxRetries ?? 2;
    // 30 calls/秒が上限。週次で数十件しか叩かないので余裕を持って 200ms 空ける。
    this.intervalMs = options.intervalMs ?? 200;
  }

  /** 現在値を返す。取れなければ throw する (欠測と区別するため)。 */
  async fetchPrice(symbol: string): Promise<number> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await this.sleep(this.intervalMs * 2 ** attempt);
      await this.waitForSlot();

      let response: Response;
      try {
        response = await this.fetchImpl(
          `${BASE_URL}?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`,
        );
      } catch (cause) {
        // 原因は残すが URL は載せない (トークンが含まれるため)。
        if (attempt === this.maxRetries) {
          throw new Error(
            `Finnhub への接続に失敗 (${safeUrlLabel(symbol)}): ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
        continue;
      }

      if (response.ok) return parsePrice(await response.json(), symbol);

      // 429 は上限超過。間隔を空けて再試行する価値がある。
      if (response.status === 429 && attempt < this.maxRetries) continue;

      // 4xx は再試行しても直らない。キーの誤りか存在しない symbol。
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Finnhub が ${response.status} を返した (${safeUrlLabel(symbol)})。API キーか symbol を確認する`,
        );
      }
      if (attempt === this.maxRetries) {
        throw new Error(`Finnhub が ${response.status} を返した (${safeUrlLabel(symbol)})`);
      }
    }
    throw new Error(`Finnhub の取得に失敗 (${safeUrlLabel(symbol)})`);
  }

  /** 呼び出し間隔を空ける。相手の上限に当てないため。 */
  private async waitForSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.intervalMs) await this.sleep(this.intervalMs - elapsed);
    this.lastRequestAt = Date.now();
  }
}

/**
 * 応答から現在値を取り出す。
 *
 * **`c` が 0 のときは失敗として扱う。** Finnhub は存在しない symbol でも 200 と
 * `{"c":0,...}` を返すため、0 を値として保存すると「株価がゼロ」という
 * ありえない観測が静かに溜まる (GAS 版も同じ判定をしている)。
 */
export function parsePrice(body: unknown, symbol: string): number {
  if (typeof body !== 'object' || body === null) {
    throw new Error(`Finnhub: 応答がオブジェクトでない (${symbol})`);
  }
  const current = (body as QuoteResponse).c;
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    throw new Error(`Finnhub: 現在値が数値でない (${symbol}: ${String(current)})`);
  }
  if (current <= 0) {
    throw new Error(
      `Finnhub: 現在値が 0 以下 (${symbol})。存在しない symbol でも 200 が返るため失敗として扱う`,
    );
  }
  return current;
}

export function readFinnhubApiKeyFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const key = env.FINNHUB_API_KEY;
  if (key === undefined || key.length === 0) {
    throw new Error(
      '環境変数 FINNHUB_API_KEY が未設定。GitHub Actions Secrets に登録し、ワークフローから渡す',
    );
  }
  return key;
}
