# tasks — macro-shiome (v1 = バリュエーション)

作成: 2026-08-16 / SDD Step 3

`docs/spec.md` (要件) `docs/screens.md` (画面) `docs/plan.md` (設計) からの分解。
**1 タスク = 1 Issue = 1 PR**。依存順に並べる。

進め方: 上から順に着手する。Phase 2 の 3 つのアダプタ (T-03〜T-05) だけは互いに独立なので並行可。

---

## Phase 1: 基盤

- [ ] **T-01 プロジェクトを初期化する** (P1) — [#1](https://github.com/rhapsody0919/macro-shiome/issues/1)
  - Next.js (App Router, TS, `output: 'export'`) + Tailwind + Recharts + vitest + eslint、pnpm
  - `.claude/launch.json` に dev 定義を追加し、`.claude/hooks/` の eslint/typecheck が実際に動くようにする
  - 受入基準: `pnpm dev` / `build` / `typecheck` / `lint` / `test` が全て通り、空のトップページが表示される

- [ ] **T-02 データ構造と指標マスタを定義する** (P1) — [#2](https://github.com/rhapsody0919/macro-shiome/issues/2)
  - `data/indicators.json` (指標マスタ)、観測値・ビュー・設定・欠測・ステータスの型定義 (plan 3 節)
  - v1 で使う指標を登録: SP500 / NASDAQ100 / DGS10 / T10YIE / DFII10 / VIXCLS / DEXJPUS
  - `data/config.json` に基準益回りの初期値 (S&P500 3.67% / NASDAQ100 3.27%) と変更履歴の構造
  - 受入基準: 型定義とマスタが揃い、マスタの内容を検証するテストが通る

---

## Phase 2: データ取得層 (T-03〜T-05 は並行可)

- [ ] **T-03 FRED アダプタを実装する** (P1) — [#3](https://github.com/rhapsody0919/macro-shiome/issues/3)
  - series_id を指定して観測値を取得。**リクエスト間 1 秒**、5xx は指数バックオフ最大 3 回
  - API キーは env から読む (`FRED_API_KEY`)。ログに出さない
  - 受入基準: 指標マスタの FRED 系指標を取得して観測値 JSON が書き出せる。**マスタに 1 行足すだけで新指標が取れる**ことをテストで示す

- [ ] **T-04 FactSet PDF アダプタを実装する** (P1) — [#4](https://github.com/rhapsody0919/macro-shiome/issues/4)
  - `EarningsInsight_MMDDYY.pdf` を取得 → テキスト抽出 → 正規表現で spec の D-6〜D-9 / D-18〜D-20 を抽出
  - 抽出項目: Forward/Trailing PER と各 5 年・10 年平均、S&P 500 終値、blended 成長率 3 時点 (今週/先週/四半期末)、次期以降の予想成長率 (Q3・Q4・CY2026・CY2027)
  - **404 は欠測として正常終了**し `data/gaps.json` に理由付きで記録する (夏季休刊週が実在)
  - **OCR は使わない** (spec の判断。誤読リスク)
  - 受入基準: 2026-08-07 号から既知の値 (forward P/E 20.0 / trailing 28.2 / 終値 7709.96 / 成長率 50.4%・47.4%・23.1%) が抽出できる。404 の号で欠測記録が残り job は成功する

- [ ] **T-05 stockanalysis アダプタを実装する** (P1) — [#5](https://github.com/rhapsody0919/macro-shiome/issues/5)
  - QQQ の Trailing PER を取得。**抽出 0 件は失敗**として扱う (構造変更の silent な破損を防ぐ、plan U-9)
  - 受入基準: QQQ の PER が取得でき、HTML 構造が変わった場合に失敗として検知される

- [ ] **T-06 取得値の検証層を実装する** (P1) — [#6](https://github.com/rhapsody0919/macro-shiome/issues/6)
  - plan 4-4 の検証: 抽出件数 / 値の範囲 (PER 5〜60、金利 −5〜20%、指数は正) / 前週比 ±20% 超で失敗 / 終値 ÷ PER = EPS の整合 / FactSet 欠測 3 週連続で失敗
  - 受入基準: 各検証が異常値を検知して失敗を返すテストが通る。**1 つでも落ちたら全体が失敗する**

- [ ] **T-07 導出値を計算する純関数群を実装する** (P1) — [#7](https://github.com/rhapsody0919/macro-shiome/issues/7)
  - Forward/Trailing EPS (指数 ÷ PER)、株式益回り、**実質金利 (DGS10 − T10YIE)**、**イールドスプレッド (益回り − 実質金利)**、理論値 (実績EPS ÷ 基準益回り)、割高率、過去最高値フラグ、前週比、相関係数
  - 受入基準: spec の実測値で検算が合う (例: 7709.96 ÷ 20.0 = 385.5、4.68% − 2.45% = 2.23%、298.14 ÷ 4% = 7453.5)。相関は欠測ペアを除外し n < 10 で「データ不足」を返す

- [ ] **T-08 画面用ビューを生成する** (P1) — [#8](https://github.com/rhapsody0919/macro-shiome/issues/8)
  - `data/views/valuation.json` を観測値 + 導出値から生成 (plan 3-4)。`data/status.json` に最終成功時刻と欠測を書く
  - 受入基準: ビューが生成され、画面が必要とする値が全て含まれる。導出値の再計算がクライアントで不要になる

---

## Phase 3: バッチ

- [ ] **T-09 週次バッチのワークフローを作る** (P1) — [#9](https://github.com/rhapsody0919/macro-shiome/issues/9)
  - `cron: '0 2 * * 6'` (UTC 土曜 02:00 = JST 土曜 11:00) + `workflow_dispatch`
  - 取得 → 検証 → ビュー生成 → `data/` を commit & push
  - **部分的に取れてもコミットはするが job は赤にする** (「緑だが歯抜け」を防ぐ)
  - secrets をログに出さない (`echo` しない、`set -x` を使わない)。**public リポの Actions ログは誰でも読める**
  - 受入基準: `workflow_dispatch` で手動実行して成功し、`data/` に差分がコミットされる

- [ ] **T-10 初回バックフィルを実行する** (P1、初回のみ) — [#10](https://github.com/rhapsody0919/macro-shiome/issues/10)
  - FRED から 10 年分、FactSet PDF を 5 年分 (約 250 ファイル、1 件 2 秒間隔、約 20 分)。別ワークフローにする
  - 受入基準: 5 年分の PER と成長率が蓄積され、**予想改定の推移が初日から表示できる**。夏季休刊週は欠測として記録される

---

## Phase 4: フロント基盤

- [ ] **T-11 レイアウト・ナビ・期間フィルターを実装する** (P1) — [#11](https://github.com/rhapsody0919/macro-shiome/issues/11)
  - N-1 ヘッダー (ナビ + 期間フィルター)、N-2 フッター。**期間は URL クエリ `?period=5y` に反映**し画面遷移・リロードで維持
  - 受入基準: 期間を切り替えると URL が変わり、リロード・共有リンクで選択が復元される

- [ ] **T-12 鮮度表示と欠測の可視化を実装する** (P2、F-10) — [#12](https://github.com/rhapsody0919/macro-shiome/issues/12)
  - `status.json` から最終更新日時と直近の欠測を表示。欠測の理由 (休刊 / 取得失敗) を区別
  - チャートの共通ルール: **欠測は線を繋がない。前方補完しない**
  - 受入基準: 欠測がある週でチャートに穴が空き、ヘッダーに理由付きの警告が出る

---

## Phase 5: バリュエーション画面 (S-1)

- [ ] **T-13 Chart 1 指数 vs EPS を実装する** (P1、F-2 / C-2) — [#13](https://github.com/rhapsody0919/macro-shiome/issues/13)
  - 二軸折れ線 + 指数切り替え (S&P500 / NASDAQ-100) + 凡例トグル + **EPS 単独モード** + **過去最高値マーカー** + 前週比
  - NASDAQ-100 の空状態は「取得経路が無い」(Forward EPS) と「蓄積中」(Trailing PER) を**出し分ける**
  - EPS が導出値であること、PER が as-reported 基準であることを明示
  - 受入基準: 3 系列が描画され、最高値更新週にマーカーが出る。指数を非表示にして EPS だけを見られる

- [ ] **T-14 Chart 2 Forward P/E と基準線を実装する** (P1、F-3 / C-3) — [#14](https://github.com/rhapsody0919/macro-shiome/issues/14)
  - Forward P/E の推移 + 5 年・10 年平均の基準線 (**毎週取得した最新値。ハードコードしない**) + 値と取得日の表示
  - 受入基準: 基準線が引かれ、現在値との上下関係が一目で分かる。「S&P 500 専用」と明示される

- [ ] **T-15 Chart 3 イールドスプレッドを実装する** (P1、F-4 / C-4) — [#15](https://github.com/rhapsody0919/macro-shiome/issues/15)
  - **益回り − 実質金利**。ゼロ線で正負を塗り分け。内訳 (益回り / 名目金利 / 期待インフレ率 / 実質金利) を凡例トグルで表示
  - 受入基準: 計算式が画面に明示され、2026-08-14 時点で S&P500 = 2.23% 相当が表示される

- [ ] **T-16 理論値と割高率を実装する** (P1、F-13 / C-9) — [#16](https://github.com/rhapsody0919/macro-shiome/issues/16)
  - 理論値と実際の指数を重ねて表示 + 割高率の推移 + **基準益回りの表示と変更 UI** + 変更履歴
  - **理論値は週内で動かない**旨と実績 EPS の更新日を併記する
  - **設定に依存する数値である**旨を常時表示。客観的な絶対値ではない
  - 受入基準: 基準益回りを変えると理論値・割高率が再計算される。設定値が常に画面に出ている

- [ ] **T-17 相関サマリーを実装する** (P1、F-5 / C-5) — [#17](https://github.com/rhapsody0919/macro-shiome/issues/17)
  - 直近半年 / 1 年 / 全期間の相関係数 + 標本数 n + バーでの可視化
  - **期間フィルターに追従しない**旨を画面に明記。n < 10 は「データ不足」
  - 受入基準: 3 期間が並び、n が併記される。データ不足時に数値を出さない

- [ ] **T-18 予想改定チャートを実装する** (P1、F-12 / C-6) — [#18](https://github.com/rhapsody0919/macro-shiome/issues/18)
  - **今週 / 先週 / 四半期末**の 3 時点比較 + CY2026・CY2027 の予想成長率の週次推移 + 前週差
  - **forward 12M EPS と並べない** (ロールによる上昇バイアスと改定を混同させない)
  - 受入基準: 3 時点が並び、前週差が符号つきで出る。バックフィル分の推移が表示される

- [ ] **T-19 サマリーバーを実装する** (P1、C-1) — [#19](https://github.com/rhapsody0919/macro-shiome/issues/19)
  - 指数 / Forward P/E / イールドスプレッド / **割高率** / 相関 のカード + 前週比 + 指数切り替え (全カード連動)
  - **割高率カードは理論値と基準益回りを必ず併記**する
  - 欠測週の前週比は**前々週との比較に落とし「2 週前比」と明示**する (plan U-S3)
  - 受入基準: 全カードが最新値と前週比を表示し、指数切り替えで全て連動する

---

## Phase 6: 残りの画面とデプロイ

- [ ] **T-20 マクロ指標画面 (S-2) を実装する** (P2、F-7) — [#20](https://github.com/rhapsody0919/macro-shiome/issues/20)
  - VIX / USDJPY / 10 年債利回りの単体チャート。**VIX に補助線は引かない** (plan U-S1)
  - 受入基準: 3 指標が表示され期間フィルターが効く

- [ ] **T-21 利用規約・出所ページとエラー画面を実装する** (P1、F-11 / S-3 / S-4) — [#21](https://github.com/rhapsody0919/macro-shiome/issues/21)
  - **FRED 必須文言**: `This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.`
  - FRED API Terms of Use へのリンクと同意条項、各指標の出所・著作権、stockanalysis の出所明記
  - **EPS/PER が as-reported ベースで一般的な値と約 9% ずれる**説明。NASDAQ の PER が ETF 由来である旨
  - 受入基準: 規約が課す必須表示が全て出ている。各チャートの ⓘ から定義の説明に到達できる

- [ ] **T-22 Cloudflare Pages にデプロイする** (P1) — [#22](https://github.com/rhapsody0919/macro-shiome/issues/22)
  - リポジトリ連携、ビルド設定、公開確認
  - 受入基準: push で自動デプロイされ、公開 URL で全画面が動作する

---

## v1 に含めないもの

- **PCE チャート** (F-8、spec U-6 で未確定) — v1 に入れるかは T-20 完了時点で判断する
- **市場サマリー** (spec 7 節) — v2
- 個別銘柄・アラート・認証 (spec 2 節「やらないこと」)

## 未解消の依存

- **T-03 の前に FRED API キーが必要** (spec U-1、ユーザー作業)。
  [fredaccount.stlouisfed.org/apikeys](https://fredaccount.stlouisfed.org/apikeys) で無料登録し、
  GitHub Actions Secrets に `FRED_API_KEY` として登録する (**会話やコミットに貼らない**)
- **T-21 の文面** (spec U-7 / screens U-S2) は実装時にユーザー確認
