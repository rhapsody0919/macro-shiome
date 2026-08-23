/**
 * Cloudflare Workers AI アダプタ (#279、ADR-0009)。
 *
 * 指標データの要約 (経済状態・警告シグナル・セクターハイライトの言語化) に使う。
 * 数値・シグナルの判定はすべて `signals.ts` (コード側) が済ませ、ここでは
 * 「言語化だけ」を依頼する — hallucination で数値が捏造される経路を無くすため。
 *
 * **API トークンはエラーにも出さない。** 公開リポジトリで Actions のログは
 * 誰でも読めるため、URL やエラーメッセージにトークンを含めない (Finnhub/Tiingo と同じ配慮)。
 */

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

function baseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;
}

interface WorkersAiResponse {
  success?: unknown;
  result?: { response?: unknown };
  errors?: unknown;
}

export interface CloudflareAiClientOptions {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

export class CloudflareAiClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(options: CloudflareAiClientOptions) {
    this.accountId = options.accountId;
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 2;
  }

  /**
   * `prompt` を渡して要約文を生成する。**トークンを含まない URL** だけを
   * エラーに載せる。
   */
  async summarize(prompt: string, systemPrompt: string): Promise<string> {
    const url = baseUrl(this.accountId);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
          }),
        });
      } catch (cause) {
        if (attempt === this.maxRetries) {
          throw new Error(
            `Cloudflare Workers AI への接続に失敗 (${url}): ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
        continue;
      }

      if (response.ok) {
        const body = (await response.json()) as WorkersAiResponse;
        const text = body.result?.response;
        if (typeof text !== 'string' || text.trim().length === 0) {
          throw new Error(`Cloudflare Workers AI の応答が空 (${url})`);
        }
        return text.trim();
      }

      // 429 は上限超過。無料枠 (1日10,000ニューロン) に対して1日1回の呼び出しは
      // 桁違いに少ないため、通常は起きない想定だが再試行の価値はある。
      if (response.status === 429 && attempt < this.maxRetries) continue;

      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Cloudflare Workers AI が ${response.status} を返した (${url})。トークンかモデル名を確認する`,
        );
      }
      if (attempt === this.maxRetries) {
        throw new Error(`Cloudflare Workers AI が ${response.status} を返した (${url})`);
      }
    }
    throw new Error(`Cloudflare Workers AI の呼び出しに失敗 (${url})`);
  }
}

/**
 * 環境変数からトークン/アカウントIDを読む。**未設定は例外にする** (呼び出し側が
 * catch してAI要約をスキップする、日次バッチ全体は失敗させない設計 — #279)。
 */
export function readCloudflareAiCredentialsFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { accountId: string; apiToken: string } {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN;
  if (accountId === undefined || accountId.length === 0) {
    throw new Error('環境変数 CLOUDFLARE_ACCOUNT_ID が未設定');
  }
  if (apiToken === undefined || apiToken.length === 0) {
    throw new Error('環境変数 CLOUDFLARE_AI_API_TOKEN が未設定');
  }
  return { accountId, apiToken };
}
