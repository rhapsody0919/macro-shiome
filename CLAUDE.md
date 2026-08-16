# macro-shiome (マクロ潮目)

**株式投資の判断に使う指標を 1 つの Web アプリに集約する**。段階を分け、**v1 = バリュエーション**
(S&P 500 / NASDAQ-100 の EPS・PER・イールドスプレッド・予想改定・理論値と割高率)、
**v2 = 市場サマリー** (日経平均・ゴールド・ドル指数・セクター別騰落率など)。
参考にする分析者の記事は転載せず、同じ指標を自分でデータソースから集めて表示する。

## 前提・制約

- **完全無料スタック** (課金しない)。無料枠の制限 (GitHub Actions の実行時間、データソース API のレート制限、Cloudflare Pages のビルド回数) は設計制約として扱う
- **週次バッチ**: GitHub Actions が **UTC 土曜 02:00 (JST 土曜 11:00)** に実行 → データ取得 → **JSON をリポジトリに commit** → push が Cloudflare Pages のビルドをトリガ
- **公開リポジトリ**。NEVER: API キー・トークンをコード / コミット / ログ / クライアントバンドルに残す。秘密情報は GitHub Actions Secrets のみ。**public リポの Actions ログは誰でも読める**
- パッケージマネージャは pnpm

## 技術スタック

SDD Step 2 で確定 (詳細 → `docs/plan.md`、判断の記録 → `docs/adr/`)。

- データストア: **Git 内 JSON** (DB を使わない。ADR-0001)。**Supabase は不採用** — 無料枠が「1 週間の非活動で停止」で週次更新の本アプリと噛み合わないため
- フロント: **Next.js 静的エクスポート** + TypeScript + Tailwind (ADR-0002)
- ホスティング: **Cloudflare Pages** (ADR-0002)
- チャート: **Recharts** (ADR-0003)
- データソース: FRED API / FactSet Earnings Insight 週次 PDF / stockanalysis.com の 3 つ

## 命令

- コミット = `type(#N): 何をしたか [why: 理由]` (#N = 対応 Issue 番号)
- 技術判断 → `docs/adr/` に 1 ファイル。凍結 `inception/` は不可侵、変更は `.agent/decisions.md`
- 技術選定 = 複数案比較で推奨。候補 2 つ以上 / 公式ドキュメントで無料枠・コスト・整合性・運用負荷を確認 / 評価軸を表で / 各案の不適合点を明示
- 原因調査 = 推測禁止、行番号・パス・コマンド出力で示す
- **金融データの定義・計算式は一次情報 (データ提供元の定義) で裏取りする**。EPS / P/E / 益回りの定義や期間 (forward 12M か実績か、暦年か会計年度か) を推測で決めない。指標の出所と定義は ADR かコードコメントに残す
- 末尾 `## STATE` を節目 (着手 / 実装完了 / push / 判断待ち) ごとに更新: (1) 進行中 Issue (#N) とタイトル (2) 進捗 (3) Next Action。進行中 + 直近完了のみ残し、2 世代以上前は `docs/state-archive.md` 先頭へ退避

## 開発フロー (省略禁止)

1. 課題発見 → 実装せず Issue へ
2. Issue 作成 (GitHub Issues、open) → 停止。NEVER: Issue 無し着手
3. ユーザーの着手指示を待つ
4. Issue に assignee を設定 (= In Progress、`gh issue edit N --add-assignee @me`)。NEVER: 指示なし着手
5. feature ブランチで実装 → typecheck / test / build 全グリーン。NEVER: スコープ外混入 / 指示なく別 Issue に着手
6. `/code-review` (Claude セルフレビュー) を diff に実行。Critical/High は即修正、Suggestion は修正 or 理由を記録
7. PR 作成。**1 Issue = 1 PR 厳守**。PR 本文に `closes #N` を記載 (マージで自動クローズ・相互リンク)。NEVER: main 直 push / 1 PR に複数 Issue / `closes #N` 欠落 / PR 本文・コミットに Claude Code 署名 (「Generated with Claude Code」「Co-Authored-By: Claude」)
8. `/codex-review` を実行 (Codex 第三者レビュー)。Codex が PR diff を read-only レビュー (観点 = ルートの `AGENTS.md`) → Claude が指摘ごとに修正 or 反論 (理由記録) → 再レビュー、を **Codex approve (Critical/High 0 件) に収束するまで自動ループ** (最大 5 ラウンド、超過は停止しユーザー判断)。修正は必ず Claude が行う (Codex はコード不変更)
9. 収束 → **Claude が自動マージ** (`gh pr merge --squash --delete-branch`) → 後続 (Issue は `closes #N` で自動クローズ・`## STATE` 更新)
   - **マージ後 CI 確認 (必須、全マージ対象)**: main push で走るワークフローの結果を確認し報告に含める。完了までバックグラウンド監視でよい。失敗時は原因を分類: (1) infra 起因 (runner 停止・ネットワーク・5xx) → `gh run rerun --failed` を **1 回だけ** (2) 実失敗 (型 / テスト / ビルド) → 即修正 or Issue 起票。**rerun も失敗したら原因を再分類して Issue 起票**。NEVER: CI 結果未確認・失敗未報告のままセッション完了
   - docs コミットの扱い: `docs:STATE` を除く **docs コミット (`docs(...)`)** はユーザーが PR diff をレビュー → OK で Claude がマージ
   - **マージ後の完了報告に確認手順を必ず含める (毎回・省略禁止、ユーザーに聞かれる前に書く)**: 「マージ・CI 確認済み」だけで終わらせない。UI / 挙動変更を伴う場合は (1) URL (2) 画面 / 操作手順 (どこをどう操作するか具体的に) (3) 期待挙動 (何が見えるはずか) を書く。バックエンドのみ (UI 変更なし) の場合も「実機確認不要と判断した理由」を一言添える。NEVER: 手順を書かずユーザーに丸投げする
   - NEVER: レビュー前マージ / Codex 未収束マージ / 収束前 Done

- Goal 外の問題は触らず Issue 起票のみ (コミット非混入)、完了報告に「新規起票: #N」を併記
- 週次バッチ (GitHub Actions) を変更した場合は、次回の定時実行を待たず `workflow_dispatch` で手動実行して成否を確認し、報告に含める

### GitHub Issues

- 起票先: 本リポの Issues。**起票〜クローズは全て Claude Code (`gh` CLI) が行う**。人手の Web UI 起票は想定しない
- Issue 項目: タイトル (動詞含む) / 背景 / ゴール / 実装方針 (任意) / 受入基準 / 関連 Issue (任意) / 想定 PR タイトル
- ラベル: 種別 `bug`・`feature`・`improvement` + 優先度 `P1` (Urgent)〜`P4` (Low) + `owner-decision` (ユーザー判断待ち)
- 状態: open = Todo / assignee あり = In Progress / closed = Done
- 相互リンク: PR 本文の `closes #N` で自動化 (手動の URL 記載は不要)

### セルフレビュー観点 (Step 6)

- 変更した関数 / 変数 / 型の呼び出し元を全列挙
- regression リスク 3 つで影響なし確認 (時系列データの欠損・週境界 / タイムゾーン / UPSERT の冪等性 / JSON スキーマ互換 / 導出値の計算式)
- 影響画面を実機確認 (ダッシュボードの各チャート・相関サマリー・期間フィルター)
- テスト 1 件以上 / コメントと実装の乖離なし / try-catch の error 経路を通す
- `/code-review`・`/codex-review` 省略可: `docs/*.md`・`CLAUDE.md`・`.agent/*` のみ / typo 1 行 / フォーマットのみ。他 (`.ts` `.tsx` `.json` / SQL / CI) は必須
- `/codex-review` ループの記録 (各指摘 → 修正 or 反論理由) を完了報告に残す

### SDD

spec + screens → plan → tasks → 実装 (1 タスク = 1 PR)、各ゲートでレビュー。起動は `.claude/commands/` の `/step1-spec` `/step1-screens` `/step2` `/step3` `/step4`。

## STATE (2026-08-16 — SDD Step 3 完了、Issue #1〜#22 起票済み。実装フェーズへ)

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

### Next Action

- **U-1 (ユーザー作業)**: [FRED API キー](https://fredaccount.stlouisfed.org/apikeys) を無料登録で取得。
  実装着手 (Step 4) 前まで
- **[#1](https://github.com/rhapsody0919/macro-shiome/issues/1) から着手**する (プロジェクト初期化)。
  以降は `docs/tasks.md` の依存順に進める。着手時は Issue に assignee を設定する
- **ユーザー作業**: [FRED API キー](https://fredaccount.stlouisfed.org/apikeys) を取得し
  GitHub Actions Secrets に `FRED_API_KEY` を登録 (#3 の前提)
- スタック確定後に `.claude/hooks/eslint-fix.sh` / `typecheck.sh` が実際に走ることを確認 (現状は
  `package.json` に該当スクリプトが無いため no-op)
