import { describe, expect, it } from 'vitest';
import { CloudflareAiClient, readCloudflareAiCredentialsFromEnv } from './cloudflare-ai';

function ok(text: string) {
  return Promise.resolve(
    new Response(JSON.stringify({ success: true, result: { response: text } }), { status: 200 }),
  );
}

describe('CloudflareAiClient (#279)', () => {
  it('応答文字列を返す', async () => {
    const client = new CloudflareAiClient({
      accountId: 'acc',
      apiToken: 'token',
      fetchImpl: () => ok('  景気は緩やかに減速している。  '),
    });
    // 前後の空白は取り除く。
    await expect(client.summarize('prompt', 'system')).resolves.toBe('景気は緩やかに減速している。');
  });

  it('トークンをURLに含めない', async () => {
    let requestedUrl: string | undefined;
    const client = new CloudflareAiClient({
      accountId: 'acc',
      apiToken: 'super-secret-token',
      fetchImpl: (input) => {
        requestedUrl = String(input);
        return ok('要約');
      },
    });
    await client.summarize('prompt', 'system');
    expect(requestedUrl).not.toContain('super-secret-token');
  });

  it('応答が空なら例外にする', async () => {
    const client = new CloudflareAiClient({ accountId: 'acc', apiToken: 'x', fetchImpl: () => ok('') });
    await expect(client.summarize('prompt', 'system')).rejects.toThrow(/応答が空/);
  });

  it('429は再試行し、それでも失敗すればトークンを含まないメッセージで落ちる', async () => {
    let calls = 0;
    const client = new CloudflareAiClient({
      accountId: 'acc',
      apiToken: 'super-secret-token',
      maxRetries: 1,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response('', { status: 429 }));
      },
    });
    await expect(client.summarize('prompt', 'system')).rejects.toThrow(/429/);
    expect(calls).toBe(2); // 初回 + 1 回の再試行
  });

  it('4xx (401等) は再試行せず即座に落ちる', async () => {
    let calls = 0;
    const client = new CloudflareAiClient({
      accountId: 'acc',
      apiToken: 'x',
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response('', { status: 401 }));
      },
    });
    await expect(client.summarize('prompt', 'system')).rejects.toThrow(/401/);
    expect(calls).toBe(1);
  });
});

describe('readCloudflareAiCredentialsFromEnv (#279)', () => {
  it('両方揃っていれば返す', () => {
    expect(
      readCloudflareAiCredentialsFromEnv({
        CLOUDFLARE_ACCOUNT_ID: 'acc',
        CLOUDFLARE_AI_API_TOKEN: 'token',
      }),
    ).toEqual({ accountId: 'acc', apiToken: 'token' });
  });

  it('CLOUDFLARE_ACCOUNT_ID が無ければ例外にする', () => {
    expect(() =>
      readCloudflareAiCredentialsFromEnv({ CLOUDFLARE_AI_API_TOKEN: 'token' }),
    ).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
  });

  it('CLOUDFLARE_AI_API_TOKEN が無ければ例外にする', () => {
    expect(() =>
      readCloudflareAiCredentialsFromEnv({ CLOUDFLARE_ACCOUNT_ID: 'acc' }),
    ).toThrow(/CLOUDFLARE_AI_API_TOKEN/);
  });
});
