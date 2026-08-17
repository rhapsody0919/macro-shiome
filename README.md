# macro-shiome (マクロ潮目)

**株式投資の判断に使う指標を 1 つの Web アプリに集約する。**
証券口座のチャートでは横断的に見づらい指標をまとめて表示し、相場の潮目を読めるようにする。

段階を分けて作る。

## v1: バリュエーション

S&P 500 / NASDAQ-100 の業績とバリュエーションを週次で蓄積・可視化する。

- 指数 vs EPS (Forward / Trailing) の二軸チャート
- Forward P/E と 5 年・10 年平均の基準線
- イールドスプレッド (株式益回り − 10 年債利回り)
- **予想改定** — アナリスト予想が先週・先月より上がっているか
- 指数と Forward EPS の相関 (直近半年 / 1 年 / 全期間)
- 期間フィルター (1 年 / 3 年 / 5 年 / 全期間)

データは GitHub Actions が毎週 (JST 土曜 11:00) に取得し、**JSON としてリポジトリに commit** する。
取得元は FRED・FactSet Earnings Insight (週次 PDF)・stockanalysis.com の 3 つ。

## v2: 市場サマリー

日経平均・ゴールド・ドル指数・セクター別騰落率などを一覧できる画面。
取得経路は調査済み ([docs/spec.md](docs/spec.md) 7 節)。

## 制約

完全無料スタックで構築する。リポジトリは public のため、秘密情報は GitHub Actions Secrets
でのみ扱う。**クライアントに秘密情報は一切出ない** (静的 JSON を配信するのみ)。

## 技術スタック

| | 選定 | 理由 |
| --- | --- | --- |
| データストア | **Git 内 JSON** | Supabase 無料枠は「1週間の非活動で停止」。週次更新の本アプリと噛み合わない ([ADR-0001](docs/adr/0001-git-json-over-supabase.md)) |
| フロント | Next.js 静的エクスポート | 既存資産の流用。v1 に SSR 不要 ([ADR-0002](docs/adr/0002-nextjs-static-export.md)) |
| ホスティング | Cloudflare Pages | 転送量に明示的上限なし ([ADR-0002](docs/adr/0002-nextjs-static-export.md)) |
| チャート | Recharts | 欠測の穴あけ・基準線・マーカーがプラグイン無しで揃う ([ADR-0003](docs/adr/0003-recharts.md)) |

設計の詳細は [docs/plan.md](docs/plan.md)。

## デプロイ

Cloudflare Pages の **Git 連携**で配信する ([ADR-0005](docs/adr/0005-cloudflare-git-integration.md))。
`main` への push で自動ビルド・自動公開される。週次バッチの commit もそのままデプロイになる。

**ビルド設定は Cloudflare のダッシュボードにあり、リポジトリには残らない。**
再現できるようここに記録する。**設定を変えたらこの表も更新すること。**

| 項目 | 値 |
| --- | --- |
| Production branch | `main` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory | `out` |
| Root directory | (空欄 = リポジトリルート) |
| 環境変数 `PNPM_VERSION` | `11.22.0` |

補足:

- **Node.js のバージョンは指定しない**。`.node-version` をリポジトリに置いてあり、
  Cloudflare と GitHub Actions が同じファイルを読む
- `PNPM_VERSION` は必要。Cloudflare v3 ビルドシステムの既定は pnpm 10.11.1 で、
  本プロジェクトの 11.22.0 と違う
- **環境変数に秘密情報は設定しない**。ビルドは `data/` の JSON を読むだけで、
  API キーを必要としない (取得は GitHub Actions 側で完結する)
- 無料枠は月 500 ビルド。週次バッチ 4 回 + PR マージ数回で十分収まる

## ドキュメント

| | |
| --- | --- |
| [docs/spec.md](docs/spec.md) | 機能要件・スコープ・データ仕様・未確定事項 |
| [docs/screens.md](docs/screens.md) | 画面とコンポーネント、UI/UX 方針 |
| [CLAUDE.md](CLAUDE.md) | 開発フロー・規約 |
| [AGENTS.md](AGENTS.md) | コードレビュー観点 |

## 開発

SDD の各ステップは Claude Code のスラッシュコマンドで起動する:
`/step1-spec` → `/step1-screens` → `/step2` → `/step3` → `/step4`。

課題管理は GitHub Issues。起票からクローズまで `gh` CLI で行う (CLAUDE.md 参照)。
