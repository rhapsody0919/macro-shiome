# macro-shiome (マクロ潮目)

マクロ指標を横断して相場の潮目を読むための可視化アプリ。主要指数 (S&P 500 / NASDAQ) と
フォワード / 実績 EPS、バリュエーション (Forward P/E、イールドスプレッド) を週次で蓄積・可視化する。
将来は VIX・為替・金利・債券入札・個人消費など、証券口座のチャートでは集めづらい指標の集約表示へ広げる。

## 前提・制約

- **完全無料スタック** (課金しない)。無料枠の制限 (Supabase の容量・非活動時の一時停止、GitHub Actions の実行時間、データソース API のレート制限) は設計制約として扱う
- **週次バッチ**: GitHub Actions が毎週土曜朝 (JST) に実行 → データ取得 → Supabase へ UPSERT
- **公開リポジトリ**。NEVER: API キー・Supabase キー・トークンをコード / コミット / ログ / クライアントバンドルに残す。秘密情報は GitHub Actions Secrets と実行環境 env 経由のみ
- パッケージマネージャは pnpm

## 技術スタック

**未確定** (SDD Step 2 = `/step2` で決定し `docs/plan.md` と `docs/adr/` に記録する)。
確定済みは Supabase (データストア) と GitHub Actions (週次バッチ) のみ。
フロント / ホスティング / チャートライブラリ / データソース API は未定 — 下記の技術選定ルールに従い複数案比較で決める。

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
- regression リスク 3 つで影響なし確認 (時系列データの欠損・週境界 / タイムゾーン / UPSERT の冪等性 / DB スキーマ互換 / API スキーマ互換)
- 影響画面を実機確認 (ダッシュボードの各チャート・相関サマリー・期間フィルター)
- テスト 1 件以上 / コメントと実装の乖離なし / try-catch の error 経路を通す
- `/code-review`・`/codex-review` 省略可: `docs/*.md`・`CLAUDE.md`・`.agent/*` のみ / typo 1 行 / フォーマットのみ。他 (`.ts` `.tsx` `.json` / SQL / CI) は必須
- `/codex-review` ループの記録 (各指摘 → 修正 or 反論理由) を完了報告に残す

### SDD

spec + screens → plan → tasks → 実装 (1 タスク = 1 PR)、各ゲートでレビュー。起動は `.claude/commands/` の `/step1-spec` `/step1-screens` `/step2` `/step3` `/step4`。

## STATE (2026-08-16 — SDD Step 1 完了、`docs/spec.md` / `docs/screens.md` 確定)

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

### Next Action

- **U-1 (ユーザー作業)**: [FRED API キー](https://fredaccount.stlouisfed.org/apikeys) を無料登録で取得。
  実装着手 (Step 4) 前まで
- `/step2` で技術スタック選定 (複数案比較 → ADR) + データ設計 + 週次バッチ設計。ここで spec の
  U-2 / U-3 / U-4 / U-9 と screens の U-S1〜U-S4 を解消する
- スタック確定後に `.claude/hooks/eslint-fix.sh` / `typecheck.sh` が実際に走ることを確認 (現状は
  `package.json` に該当スクリプトが無いため no-op)
