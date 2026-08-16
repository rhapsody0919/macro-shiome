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

データは GitHub Actions が毎週土曜朝 (JST) に取得し、Supabase へ UPSERT する。
取得元は FRED・FactSet Earnings Insight (週次 PDF)・stockanalysis.com の 3 つ。

## v2: 市場サマリー

日経平均・ゴールド・ドル指数・セクター別騰落率などを一覧できる画面。
取得経路は調査済み ([docs/spec.md](docs/spec.md) 7 節)。

## 制約

完全無料スタックで構築する。リポジトリは public のため、API キー・Supabase キーは
GitHub Actions Secrets と実行環境 env でのみ扱う。

技術スタックは未確定 (SDD Step 2 で決定し `docs/plan.md` と `docs/adr/` に記録)。

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
