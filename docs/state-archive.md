# state-archive

`CLAUDE.md` の `## STATE` から退避した過去の記録。新しいものを上に置く。
過去の経緯を追うときだけ参照する。

---

## 設計フェーズ (SDD Step 1〜3) — 2026-08-16 (2026-08-16 — SDD Step 3 完了、Issue #1〜#22 起票済み。実装フェーズへ)

**開発規約の移植 (完了)**: hakumei-app の規約一式を移植した — `CLAUDE.md` (本ファイル)・`AGENTS.md`
(Codex レビュアー規約)・`.claude/settings.json` + `hooks/`・`.claude/commands/` (SDD step1〜4 +
codex-review)・`scripts/codex-review*`。hakumei 固有の AWS / Bedrock / ECS / デモ環境の記述は落とし、
本プロジェクト固有の観点に差し替えた。

**SDD Step 1 (完了)**: `docs/spec.md` を確定。データソースの実現可能性を実測で調査した結果、
当初要件から 4 点変更した。(1) EPS / PER は **as-reported (GAAP) ベース**に統一 — operating ベースの
週次一次ソース (S&P Global 公式 xlsx) は curl 403・ブラウザも Access Denied で自動取得不可。一般的な
投資レポート (operating) とは約 9% ずれる (2) 「NASDAQ」を **NASDAQ-100** に確定 — PER を取れる QQQ が
NASDAQ-100 連動のため、NASDAQ 総合では指数と PER の対象がずれる (3) Forward P/E の基準線は**固定値を
やめ FactSet PDF から毎週取得** — 当初の 19.5 / 18.0 倍は実値 (19.9 / 19.0) とずれており毎週更新される
(4) **NASDAQ の Forward P/E は v1 スコープ外** — 無料経路が存在しない。

データソースは 3 つに確定: FRED (指数・DGS10・VIX・USDJPY・PCE) + FactSet Earnings Insight 週次 PDF
(S&P 500 の Forward / Trailing PER・各平均・終値) + stockanalysis.com (QQQ の Trailing PER)。
**EPS の絶対値を一次取得できる無料経路は存在しない**ため、全て「指数 ÷ PER」の導出値とする
(実測で潰した経路: FactSet の EPS ページは画像、S&P Global xlsx は 403、Yardeni は 2023-12 で更新停止、
WSJ は JS レンダリング + 内部 API 400、Yahoo は 429、Stooq は JS チャレンジ)。

**SDD Step 1 (UI) — `docs/screens.md` (完了)**: 画面は 4 つ。**指標グループ別に分割**した —
S-1 バリュエーション (`/`、指数 vs EPS・Forward P/E・スプレッド・相関) / S-2 マクロ指標 (`/macro`、
VIX・USDJPY・10 年債・PCE。**将来の指標追加はここが受け皿**) / S-3 利用規約・出所 (`/terms`) /
S-4 エラー。当初は F-6 を根拠に単一ページへ集約したが、期間フィルターを URL クエリで共有すれば
分割しても成立するため、ユーザー指示を受けて「見る目的」で分けた。

設計判断: (1) 相関サマリーだけは期間フィルターに追従させない (半年 / 1 年 / 全期間の比較が目的。
画面に明記する) (2) NASDAQ-100 の空状態は「取得経路が無い」(Forward EPS、恒久) と「蓄積中」
(Trailing PER、時間で解消) を出し分ける (3) UI/UX 方針 6 項目を明文化 — 誤読防止を最優先
(EPS は導出値・PER は as-reported・NASDAQ の PER は ETF 由来)、評価語を使わず事実で書く
(「割高」ではなく「5 年平均を上回る」)、欠測を隠さない、色だけに情報を載せない、期間は URL に載せる、
モバイルでは二軸チャートを縦 2 枚に分割。

**技術選定への制約 (U-S4)**: チャートライブラリは二軸・凡例トグル・**欠測の穴あけ (線を繋がない)** に
対応できることが選定条件。特に欠測の穴あけはライブラリ間で対応が分かれるため Step 2 の比較軸に入れる。

**ゴールの明確化 + 追加調査 (2026-08-16)**: プロジェクトのゴールは「**株式投資の判断に使う指標を
1 つの Web アプリに集約する**」。段階を分け、**v1 = バリュエーション**、**v2 = 市場サマリー**
(日経平均・ゴールド・ドル指数・セクター別騰落率など) とした。参考にする分析者の記事そのものは
転載せず、**同じ指標を自分でデータソースから集めて表示する**。

この過程で 3 つ判明した。(1) **EPS 改定の推移が本文テキストから取れる** — FactSet PDF に
「今週 50.4% / 先週 47.4% / 四半期末 23.1%」と 3 時点が毎週明記されており、これがユーザーの
主目的「予想が先週より上がったか」に直接答える。CY 別成長率から EPS も誤差 1% 以内で復元できる
(2) **OCR は不採用** — p.31-32 の EPS はグラフ画像内のラベルとして存在するが、tesseract は
300/600dpi とも誤読 (89.20→69.20 等)。silent な誤りが蓄積するため使わない (3) **5 年バックフィル可**
— 2021〜2025 の金曜サンプル 15 件がすべて 200、404 は夏季休刊週のみ。これで **予想改定の推移を
初日から 5 年分表示できる** (spec U-4 解消)。

v2 の指標も取得経路を実測済み: 日経平均 `NIKKEI225`・ドル指数 `DTWEXBGS`・金利 `DGS2`/`T10Y2Y`/`DFF`
はいずれも FRED で**著作権制限なし**。ゴールドは FRED に価格が無く GLD (ETF)、セクター別騰落率も
セクター ETF から取る。**「DXY」は FRED に無い** — `DTWEXBGS` は貿易加重の別指数 (水準も 119 対 100 前後)
なので「ドル指数 (貿易加重)」と正しい名前で表示する。

**課題管理は GitHub Issues** (Linear ではなく)。理由 = CLAUDE.md のフローが既に GitHub Issues 前提
(`closes #N` で自動クローズ)、`gh` CLI で Claude が完結できる、public リポの秘密情報を増やさない、
hakumei-app が Linear から移行済み。**Step 3 で tasks.md に分解したらそのまま Issue として起票する**。

**SDD Step 2 (完了)**: `docs/plan.md` + ADR 4 本。最大の判断は **Supabase を使わないこと**
([ADR-0001](docs/adr/0001-git-json-over-supabase.md))。公式で無料枠を確認したところ
「Free projects are paused after 1 week of inactivity」と明記されており、**週次更新かつ低アクセスの
本アプリは停止条件を踏みやすい**。データ量も約 3 万件 (数 MB) で DB が要らない規模のため、
取得結果を JSON としてリポジトリに commit し静的配信する構成にした。副次的に**クライアントへ
秘密情報が一切出なくなる** (anon key すら不要)。スタックは Next.js 静的エクスポート +
Cloudflare Pages + Recharts。Recharts は `connectNulls: false` が既定で**欠測の穴あけが
プラグイン無しで実現できる**ことをソースで確認 (screens U-S4 の選定条件)。

データ設計は**指標マスタ + 観測値の縦持ち** ([ADR-0004](docs/adr/0004-indicator-master-schema.md))。
FRED 系の新指標は**マスタに 1 行足すだけでコード変更不要**にした (輸入物価・CPI・PCE 等の追加候補の
大半が該当)。観測日をキーにすることで **UPSERT の冪等性を構造で保証**する。バッチは
**UTC 土曜 02:00 (JST 土曜 11:00)** — FactSet が金曜発行で、JST 土曜早朝だと当日号が無い恐れがあるため。

**SDD Step 3 (完了)**: `docs/tasks.md` に 22 タスクへ分解し、**GitHub Issue #1〜#22 として起票済み**
(タスク番号 T-01〜T-22 と Issue 番号が一致)。Phase 1 基盤 (#1-#2) → Phase 2 データ取得 (#3-#8、
アダプタ 3 種は並行可) → Phase 3 バッチ (#9-#10) → Phase 4 フロント基盤 (#11-#12) →
Phase 5 バリュエーション画面 (#13-#19) → Phase 6 残りとデプロイ (#20-#22)。

**#3 (FRED アダプタ) の着手には FRED API キーが必要** (spec U-1)。ユーザーが無料登録し
GitHub Actions Secrets に `FRED_API_KEY` として登録する。**会話やコミットに貼らない**。
キーが未取得の間は #1 / #2 / #4 / #5 を先に進められる。

#### Next Action

- **U-1 (ユーザー作業)**: [FRED API キー](https://fredaccount.stlouisfed.org/apikeys) を無料登録で取得。
  実装着手 (Step 4) 前まで
- **[#1](https://github.com/rhapsody0919/macro-shiome/issues/1) から着手**する (プロジェクト初期化)。
  以降は `docs/tasks.md` の依存順に進める。着手時は Issue に assignee を設定する
- **ユーザー作業**: [FRED API キー](https://fredaccount.stlouisfed.org/apikeys) を取得し
  GitHub Actions Secrets に `FRED_API_KEY` を登録 (#3 の前提)
- スタック確定後に `.claude/hooks/eslint-fix.sh` / `typecheck.sh` が実際に走ることを確認 (現状は
  `package.json` に該当スクリプトが無いため no-op)
