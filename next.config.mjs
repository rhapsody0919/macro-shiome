/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静的エクスポート (ADR-0002)。Cloudflare Pages へ out/ を配信する。
  output: 'export',
  // 静的エクスポートでは Next.js の画像最適化が使えない。
  images: { unoptimized: true },
  // 末尾スラッシュを付けて静的ホスティングでのパス解決を安定させる。
  trailingSlash: true,
};

export default nextConfig;
