import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /**
     * 既定の 5 秒では足りない (#219)。
     *
     * ページ全体を描画するテストは 1 件で 6〜7 秒かかる。チャートが 77 枚あり、
     * `/economy` は 1 ページに 28 枚を並べるため。**実測で既存のテストが
     * 6,702ms で落ちた**ので、開発マシンより遅い CI では確実に不安定になる。
     *
     * 遅いこと自体は問題として残る。**描画を伴うテストは 1 つの it にまとめる**方針で、
     * ページ全体の描画回数を増やさない。
     */
    testTimeout: 20_000,
  },
});
