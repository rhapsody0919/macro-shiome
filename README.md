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

データは GitHub Actions が**毎日 (UTC 02:00 = JST 11:00)** 取得し、**JSON としてリポジトリに commit** する。
取得元は FRED・FactSet Earnings Insight (週次 PDF)・stockanalysis.com・米財務省 Fiscal Data・Finnhub の 5 つ。
値が動かない日は差分が出ないため、commit もビルドも走らない。

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

Cloudflare Workers (Static Assets) の **Git 連携**で配信する
([ADR-0005](docs/adr/0005-cloudflare-git-integration.md))。
`main` への push で自動ビルド・自動公開される。定期バッチの commit もそのままデプロイになる。

配信の設定は [`wrangler.jsonc`](wrangler.jsonc) にあり、**リポジトリで管理している**
(`out/` を静的アセットとして配信、404 は `out/404.html`)。Worker スクリプトは持たない。

ダッシュボード側で指定するのは次の 3 つだけ。**変えたらこの表も更新すること。**

| 項目 | 値 |
| --- | --- |
| Worker 名 | `macro-shiome` (**`wrangler.jsonc` の `name` と一致必須**。食い違うとビルドが失敗する) |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command | `npx wrangler deploy` (既定のまま) |

補足:

- **環境変数に秘密情報は設定しない**。ビルドは `data/` の JSON を読むだけで API キーを
  必要としない (取得は GitHub Actions 側で完結する)
- `.node-version` を Cloudflare と GitHub Actions が共有する。片方だけ変わるのを防ぐため
- pnpm のバージョンが合わない場合は環境変数 `PNPM_VERSION` に `11.22.0` を設定する
- ローカルで設定を検証するには `npx wrangler deploy --dry-run` (認証不要)

公開 URL: https://macro-shiome.o104085t.workers.dev

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
