# 0005. Cloudflare へのデプロイは Git 連携で行う

- ステータス: 採用 (2026-08-17 に配信先を Pages → Workers Static Assets へ修正)
- 日付: 2026-08-17
- 関連: [ADR-0002](0002-nextjs-static-export.md)、#22

## 2026-08-17 の修正 — 配信先を Workers に変更した

当初は **Cloudflare Pages** に配信する前提で書いていた。実際にダッシュボードで作成しようとした
ところ、**Pages プロジェクトを Git 連携で新規作成する導線が存在しなかった**。

- 公式ドキュメント ([Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)) は
  今も「Workers & Pages → Create application → Pages → Connect to Git」と案内している
- しかし実際の UI (2026-08-17 時点) では、Git 連携の作成フローが **「Create a Worker」**
  に一本化されており、Deploy command の既定が `npx wrangler deploy` になっていた
- Pages のドキュメントに非推奨・メンテナンスモードの記載は無いが、**新規作成の導線が
  無い以上 Pages は選べない**

**本 ADR の決定 (Git 連携を使う) は変えない。** 変わったのは配信先だけで、比較の論拠
(秘密情報を増やさない / 不可逆でない) はそのまま成り立つ。Workers Builds も Git 連携であり、
Cloudflare 側が GitHub を読むため API トークンを GitHub Secrets に置く必要が無い。

### Workers Static Assets での設定

Worker スクリプトは持たず、静的アセットのみを配信する。公式に
"The `main` key is optional for assets-only Workers." と明記がある
([Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/))。

設定は `wrangler.jsonc` に置き、**リポジトリで管理する**。Pages のダッシュボード設定と違い
バージョン管理できるため、ADR-0005 で挙げた「設定がリポジトリに残らない」という
案 A の不適合点はこれで解消した。

| キー | 値 | 理由 |
| --- | --- | --- |
| `assets.directory` | `./out/` | `next.config.mjs` の `output: 'export'` の出力先 |
| `assets.not_found_handling` | `404-page` | ビルドが生成する `out/404.html` を 404 で返す |
| `assets.html_handling` | `auto-trailing-slash` | `trailingSlash: true` と整合。既定値だが意図を明示 |

`name` は**ダッシュボードの Worker 名と一致させる**必要がある。食い違うとビルドが失敗する。

## 背景

ホスティング先は ADR-0002 で Cloudflare Pages に決めている。**どう配信物を届けるか**は
未決だった。Cloudflare Pages には 2 つの方式がある。

本プロジェクトの制約が判断に効く。

- **公開リポジトリ**。秘密情報は増やさないほど良い (Actions ログは誰でも読める)
- 週次バッチが JSON をコミット → push でデプロイが走る流れを前提にしている
- 完全無料スタック

## 検討した選択肢

| 評価軸 | 案 A: Git 連携 | 案 B: Direct Upload (wrangler) |
| --- | --- | --- |
| 秘密情報 | **不要** (Cloudflare 側が GitHub を読む) | **Cloudflare API トークンを GitHub Secrets に置く** |
| ビルド場所 | Cloudflare | GitHub Actions |
| 無料枠 | 月 500 ビルド / 同時 1<sup>1</sup> | Actions は public リポで無制限 |
| 設定の所在 | **ダッシュボード** (リポジトリに残らない) | ワークフロー YAML (リポジトリに残る) |
| 後戻り | wrangler も併用できる | **Git 連携に切り替えられない**<sup>2</sup> |
| プレビュー | PR ごとに自動生成 | ブランチ指定が要る |

<sup>1</sup> [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/) で
確認 (2026-08-17): 月 500 ビルド、同時ビルド 1、20,000 ファイル、1 ファイル 25 MiB。
静的アセットへのリクエストは無料・無制限。

<sup>2</sup> [Direct Upload の公式ドキュメント](https://developers.cloudflare.com/pages/get-started/direct-upload/)に
"you cannot switch to Git integration later" と明記。**不可逆な選択**。

## 決定

**案 A (Git 連携) を採用する。**

決め手は 2 つ。

1. **秘密情報を増やさない**。案 B は Cloudflare API トークンを GitHub Secrets に置く必要がある。
   public リポジトリで管理する秘密は少ないほど良く、現状 FRED の API キー 1 本で済んでいる
2. **不可逆でない**。Direct Upload を選ぶと後から Git 連携に戻せない。Git 連携を選んでおけば
   必要になったとき wrangler も併用できる

ビルド回数の懸念は無い。週次バッチ 4 回/月 + PR マージ数回で、500 回に対して 1 桁台に収まる。

## 案 A の不適合点と対処

- **ビルド設定がリポジトリに残らない** — ダッシュボードの設定値を `README.md` に記録する。
  設定を変えたら README も直す
- **ビルド環境が CI と違う** — Cloudflare v3 ビルドシステムの既定は Node.js 22.16.0 /
  pnpm 10.11.1。本プロジェクトは pnpm 11.22.0 を使うため、環境変数 `PNPM_VERSION` で明示する。
  Node.js は `.node-version` をリポジトリに置き、**CI と Cloudflare が同じファイルを読む**ようにした
- **ビルド失敗が Cloudflare 側でしか分からない** — CI (`ci.yml`) が同じ `pnpm build` を
  全 PR で回しているため、マージ前に気付ける

## 案 B を採らなかった理由

秘密情報が増えることと、不可逆であることが上回った。GitHub Actions でビルドできる利点
(CI と同一環境) は、CI が同じビルドを走らせている以上ほとんど価値が無い。
