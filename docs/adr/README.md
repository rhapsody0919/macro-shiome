# ADR (Architecture Decision Record)

重要な技術判断は 1 判断 = 1 ファイルで残す。ファイル名は `NNNN-kebab-case-title.md` (連番)。

書式:

```
# NNNN. タイトル

- ステータス: 提案 / 採用 / 棄却 / 置換 (置換の場合は置換先 ADR 番号)
- 日付: YYYY-MM-DD
- 関連: #Issue番号

## 背景

## 検討した選択肢

| 評価軸 | 案A | 案B |
| --- | --- | --- |

各案の不適合点を明示する。

## 決定

## 理由

## 影響・トレードオフ
```

## 一覧

| ADR | 判断 | 日付 |
| --- | --- | --- |
| [0001](0001-git-json-over-supabase.md) | データストアに Supabase ではなく Git 内 JSON を採用 | 2026-08-16 |
| [0002](0002-nextjs-static-export.md) | フロントは Next.js 静的エクスポート、ホスティングは Cloudflare Pages | 2026-08-16 |
| [0003](0003-recharts.md) | チャートライブラリに Recharts を採用 | 2026-08-16 |
| [0004](0004-indicator-master-schema.md) | 指標マスタ + 観測値の縦持ちスキーマ | 2026-08-16 |
| [0005](0005-cloudflare-git-integration.md) | Cloudflare Workers Static Assets に Git 連携で公開 | 2026-08-17 |
| [0006](0006-treasury-auctions.md) | 国債入札は米財務省 Fiscal Data から取る | 2026-08-18 |
| [0007](0007-estat-dashboard.md) | 日本の経済指標は統計ダッシュボード API から取る (登録不要) | 2026-08-19 |
| [0008](0008-tiingo-ohlcv.md) | ETF の日足 OHLCV は Tiingo から取る | 2026-08-21 |
| [0009](0009-cloudflare-workers-ai.md) | AI要約のLLMはCloudflare Workers AIを使う | 2026-08-23 |
