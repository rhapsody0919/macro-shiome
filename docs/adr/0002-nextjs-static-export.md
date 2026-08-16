# 0002. フロントは Next.js 静的エクスポート、ホスティングは Cloudflare Pages

- ステータス: 採用
- 日付: 2026-08-16
- 関連: SDD Step 2、[ADR-0001](0001-git-json-over-supabase.md)

## 背景

ADR-0001 でデータを静的 JSON にしたため、フロントに SSR は不要になった。
完全無料スタックの制約下で、フレームワークとホスティングを選ぶ。

## 検討した選択肢

### フレームワーク

| 評価軸 | 案 A: Next.js 静的エクスポート | 案 B: SvelteKit | 案 C: Astro |
| --- | --- | --- | --- |
| 静的出力 | `output: 'export'` | adapter-static | 標準が静的 |
| チャート | Recharts (React) | Chart.js 等 | React 島も可 |
| 既存資産 | **同一開発者が hakumei-app で使用中** | 新規学習 | 新規学習 |

不適合点: 案 A は静的用途にはやや重い。案 B は React 前提のチャート資産が使えず選択肢が狭い。
案 C は期間フィルターのような対話的な状態管理がやや面倒。

### ホスティング

| 評価軸 | 案 A: Cloudflare Pages | 案 B: Vercel Hobby | 案 C: GitHub Pages |
| --- | --- | --- | --- |
| 転送量 | 明示的上限なし | 100GB/月 | ソフト制限 |
| ビルド | 500 回/月 | 制限あり | Actions 経由 |
| ファイル数 | 20,000 / 25MiB per file | — | — |

不適合点: 案 A は Next.js 固有機能 (ISR・Image Optimization 等) が使えない。
案 B は **Hobby プランが商用利用不可**で、将来方針が変わると移行が必要。
案 C はビルド設定の自由度が低い。

## 決定

**Next.js 静的エクスポート + Cloudflare Pages** を採用する。

## 理由

1. **既存資産**。同じ開発者が hakumei-app (Next.js 15 + TS + Tailwind) を運用しており、
   規約・ツールチェーン・レビュー観点をそのまま流用できる。学習コストがゼロに近い
2. **v1 に SSR が要らない**。データは週次更新の静的 JSON で、ビルド時に確定する
3. **転送量に明示的上限が無い**。Vercel Hobby の 100GB/月 でも当面足りるが、
   商用利用制限を将来の制約として抱えずに済む

## 影響・トレードオフ

- Next.js 固有の動的機能 (ISR、Server Actions、Image Optimization) は使えない。
  v1 の要件には不要
- 日中の更新が必要になった場合、静的ビルドでは即時反映できない。
  その時点で ISR または別構成を検討する (週次更新である限り問題にならない)
- Cloudflare Pages のビルド 500 回/月 に対し、実際は週 1 回のデータ更新 + 開発時の push。
  十分な余裕がある
