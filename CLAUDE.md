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
8. **`/codex-review` は一時中断中** (2026-08-16、ユーザー判断)。PR 作成後は Step 9 のマージへ進む
   <!-- 再開する場合: `npm i -g @openai/codex && codex login` を実行し、以下を戻す。
   レビュー観点は AGENTS.md に、実行スクリプトは scripts/codex-review* に維持してある。
   8. `/codex-review` を実行 (Codex 第三者レビュー)。Codex が PR diff を read-only レビュー
   (観点 = ルートの `AGENTS.md`) → Claude が指摘ごとに修正 or 反論 (理由記録) → 再レビュー、を
   **Codex approve (Critical/High 0 件) に収束するまで自動ループ** (最大 5 ラウンド、超過は停止し
   ユーザー判断)。修正は必ず Claude が行う (Codex はコード不変更) -->
9. 収束 → **Claude が自動マージ** (`gh pr merge --squash --delete-branch`) → 後続 (Issue は `closes #N` で自動クローズ・`## STATE` 更新)
   - **マージ後 CI 確認 (必須、全マージ対象)**: main push で走るワークフローの結果を確認し報告に含める。完了までバックグラウンド監視でよい。失敗時は原因を分類: (1) infra 起因 (runner 停止・ネットワーク・5xx) → `gh run rerun --failed` を **1 回だけ** (2) 実失敗 (型 / テスト / ビルド) → 即修正 or Issue 起票。**rerun も失敗したら原因を再分類して Issue 起票**。NEVER: CI 結果未確認・失敗未報告のままセッション完了
   - docs コミットの扱い: `docs:STATE` を除く **docs コミット (`docs(...)`)** はユーザーが PR diff をレビュー → OK で Claude がマージ
   - **マージ後の完了報告に確認手順を必ず含める (毎回・省略禁止、ユーザーに聞かれる前に書く)**: 「マージ・CI 確認済み」だけで終わらせない。UI / 挙動変更を伴う場合は (1) URL (2) 画面 / 操作手順 (どこをどう操作するか具体的に) (3) 期待挙動 (何が見えるはずか) を書く。バックエンドのみ (UI 変更なし) の場合も「実機確認不要と判断した理由」を一言添える。NEVER: 手順を書かずユーザーに丸投げする
   - NEVER: レビュー前マージ (`/code-review` は省略不可) / 収束前 Done

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
- `/code-review` 省略可: `docs/*.md`・`CLAUDE.md`・`.agent/*` のみ / typo 1 行 / フォーマットのみ。他 (`.ts` `.tsx` `.json` / SQL / CI) は必須
  <!-- 一時中断: `/codex-review` スキップ中のため、ループ記録を完了報告に残すルールは凍結 -->

### SDD

spec + screens → plan → tasks → 実装 (1 タスク = 1 PR)、各ゲートでレビュー。起動は `.claude/commands/` の `/step1-spec` `/step1-screens` `/step2` `/step3` `/step4`。

## STATE (2026-08-17 — 実装フェーズ、17/26 Issue 完了)

設計フェーズ (SDD Step 1〜3) の経緯は `docs/state-archive.md` に退避済み。

### 完了 (17 件)

| 範囲 | Issue | 要点 |
| --- | --- | --- |
| 基盤 | #1 #2 | Next.js 16 静的エクスポート。**TS 6 / ESLint 9 に意図的に固定** |
| 取得層 | #3 #4 #5 | FRED / FactSet PDF / stockanalysis。**API キーはエラーにも出さない** |
| 検証・導出 | #6 #7 #8 | 1 件でも落ちたら全体失敗。導出値は実測値で検算済み |
| バッチ | #9 #10 | 週次 (UTC 土 02:00) + バックフィル |
| 画面基盤 | #11 #12 | 期間フィルターを URL に載せる。鮮度・欠測表示 |
| チャート | #13〜#19 #20 | バリュエーション 6 種 + サマリーバー + マクロ指標 |
| 規約 | #21 | 利用規約・出所ページ。出所一覧は指標マスタから自動生成 |
| 改善 | #46 #52 #53 #54 | 基準益回りの内訳 / スプレッドの分布 / 欠測理由の区別 / 蓄積中表示 |
| CI | #23 | typecheck / lint / test / build |

テスト 238 件。CI は全 PR で稼働中。

### 実装中に判明した重要な点

- **フィクスチャは実データの代わりにならない**。#4 で「ユニットテストは通るのに実 PDF で
  抽出できない」ことが起きた。以降、実データに対する統合テストを `*.integration.test.ts` に残す
- **机上の閾値は実測で調整が要る**。#6 で増益率に前週比 ±20% を当てると必ず失敗した
- **長時間ジョブの実行中に PR をマージしない**。#10 のバックフィル中に push が reject された
- **提供元の仕様は実データで確認する** (#53)。FactSet は翌暦年の予想を年央から載せ始めるため、
  年前半の欠落は正常。これを「取得失敗」として記録していた
- **判定は期間フィルター前の系列で行う** (#54)。フィルター後だと期間を絞っただけで
  「蓄積中」と誤表示される
- **ブラウザ pane では画面下部の実機確認ができない**。`document.hidden: true` /
  `innerWidth: 0` で React がハイドレーションを遅延させる。
  代わりに Testing Library のコンポーネントテストで検証する

### データの制約 (画面に出している)

- **NASDAQ-100 の実績 PER は過去に遡れない**。QQQ 経由でしか取れず提供元が現在値しか出さない。
  2026-08 時点で 1 点のみ。週次で蓄積するしかない
- **EPS はすべて導出値** (指数 ÷ PER)。絶対値を無料で取れる経路が無い
- **イールドスプレッドの水準** (2026-08-07、S&P 500): 平均 3.70% / σ 1.23 / n 168。
  現在 2.60% は下位 16%。**固定の危険水準は置かない** (恣意的になるため)

### Next Action

- **#22 (Cloudflare Pages デプロイ)** — 残る唯一の未着手 Issue。
  ユーザーのアカウント連携操作が必要
- `not-in-report` の実データ検証は次に FactSet が発行される週に持ち越し
  (2026-08-14 は夏季休刊で PDF 自体が無かった)
