# plan — macro-shiome (システム設計)

作成: 2026-08-16 / SDD Step 2

`docs/spec.md` (v1 = バリュエーション) と `docs/screens.md` を実装可能な設計に落とす。
重要な判断は `docs/adr/` に 1 判断 = 1 ファイルで記録した (末尾に一覧)。

---

## 1. アーキテクチャ概要

```
GitHub Actions (週次 cron)
  ├─ FRED API          ── 指数・金利・期待インフレ率・VIX・為替
  ├─ FactSet 週次 PDF  ── Forward/Trailing PER・各平均・終値・成長率3時点
  └─ stockanalysis.com ── QQQ の Trailing PER
        ↓ 取得・検証・整形
  data/*.json をリポジトリに commit
        ↓ push が Cloudflare Pages のビルドをトリガ
  Next.js (静的エクスポート) + Recharts
        ↓
  Cloudflare Pages (CDN 配信、認証なし公開)
```

**データベースを使わない。** 取得結果を JSON としてリポジトリに commit し、静的サイトが読む
(ADR-0001)。理由は 3 節。

---

## 2. 技術スタック選定

### 2-1. データストア (最重要の判断)

| 評価軸 | 案 A: Supabase | 案 B: Git 内 JSON (採用) | 案 C: Cloudflare D1 |
| --- | --- | --- | --- |
| 無料枠 | 500MB / egress 5GB | **リポジトリ容量のみ** | 5GB / 500 万行読取/日 |
| **停止リスク** | **1 週間の非活動で自動停止** | **無し** | 無し |
| クライアントの秘密情報 | anon key が露出 (RLS 前提) | **不要** | Workers 経由なら不要 |
| クエリ | SQL | 全件読み込み + クライアント処理 | SQL |
| データ履歴 | 別途設計が必要 | **git が履歴になる** | 別途設計が必要 |
| 運用負荷 | RLS 設計・キー管理・停止監視 | **ほぼ無し** | Workers の実装が必要 |
| 不適合点 | **週次更新かつ低アクセスの本アプリでは停止条件を踏みやすい**。停止すると画面が死ぬ | データ増大に弱い。同時書き込み不可 | v1 に SQL が要る場面が無く過剰 |

**案 B を採用**。決め手は 2 つ。

1. **Supabase 無料プランは「1 週間の非活動で停止」**([公式](https://supabase.com/pricing))。
   本アプリは更新が週 1 回・閲覧も多くない想定で、この条件を踏みやすい。停止すれば画面が動かない
2. **データ量が小さい**。試算で週次 12 指標 × 52 週 × 10 年 ≒ 6,200 行 + 日次系列 ≒ 25,000 行 =
   合計 3 万件程度。JSON で数 MB、gzip 後は数百 KB。DB を持つ必要がない

副次的な利点として、**クライアントに秘密情報が一切出ない** (静的 JSON を読むだけなので anon key すら
不要)。public リポである本プロジェクトの制約と噛み合う。

**採用しない場合の再検討条件**: 指標が増えてデータが 50MB を超える、または画面から書き込みが
必要になったら案 A/C を再評価する。

### 2-2. フロントエンド

| 評価軸 | 案 A: Next.js 静的エクスポート (採用) | 案 B: SvelteKit | 案 C: Astro |
| --- | --- | --- | --- |
| 静的出力 | `output: 'export'` で対応 | adapter-static で対応 | 標準が静的 |
| チャート | Recharts (React) が使える | Chart.js 等 | React 島も可 |
| 既存資産 | **同一開発者が hakumei-app で使用中** | 新規学習 | 新規学習 |
| 不適合点 | 静的用途にはやや重い | チャート選択肢が React より狭い | 対話的な状態管理 (期間フィルター) がやや面倒 |

**案 A を採用**。決め手は既存資産。同じ開発者が hakumei-app (Next.js 15 + TS + Tailwind) を運用中で、
規約・ツールチェーンをそのまま流用できる。v1 に SSR は不要なので静的エクスポートで足りる。

### 2-3. チャートライブラリ

screens の要件 (二軸 / 凡例トグル / **欠測の穴あけ** / 基準線 / マーカー / 正負の塗り分け) で判定。

| 要件 | Recharts (採用) | Chart.js | ECharts |
| --- | --- | --- | --- |
| 欠測の穴あけ | **`connectNulls: false` が既定** (ソースで確認) | `spanGaps: false` | `connectNulls: false` |
| 二軸 | `yAxisId` | `yAxisID` | 複数 yAxis |
| 基準線 (平均線・ゼロ線) | `ReferenceLine` | annotation プラグインが別途必要 | markLine |
| マーカー (過去最高値) | `ReferenceDot` | annotation プラグイン | markPoint |
| 正負の塗り分け | `ReferenceArea` / gradient | プラグイン頼み | visualMap |
| React 統合 | **ネイティブ** | ラッパーが必要 | ラッパーが必要 |
| 不適合点 | **凡例クリックのトグルが標準に無く自前実装が要る**。大量データに弱い | 基準線・マーカーがプラグイン依存 | バンドルが大きく、React 統合が薄い |

**Recharts を採用**。要件のうち欠測・基準線・マーカーが**追加プラグイン無しで揃う**のが決め手。
凡例トグルは `Legend` の `onClick` と各系列の `hide` prop で実装できる (数十行)。
データ量は数千点で性能問題は出ない。

### 2-4. ホスティング

| 評価軸 | 案 A: Cloudflare Pages (採用) | 案 B: Vercel Hobby | 案 C: GitHub Pages |
| --- | --- | --- | --- |
| 転送量 | 明示的上限なし | **100GB/月** | ソフト制限あり |
| ビルド | 500 回/月 | 制限あり | Actions 経由 |
| ファイル数 | 20,000 / 25MiB per file | — | — |
| 不適合点 | Next.js 固有機能は使えない (静的のみ) | **Hobby は商用利用不可**。将来の方針変更時に移行が必要 | 独自ビルドの自由度が低い |

**案 A を採用**。静的サイトなので Next.js 固有機能は不要。転送量に明示的上限がないこと、
Vercel Hobby の商用利用制限を将来の制約として抱えずに済むことが決め手。

---

## 3. データ設計

### 3-1. 方針: 指標マスタ + 観測値 (ADR-0004)

指標は**継続的に増える** (輸入物価・住宅ローン申請・10 年債入札など)。
指標ごとにテーブルや列を作る設計では追加のたびに構造変更が要るため、**縦持ち**にする。

### 3-2. 指標マスタ `data/indicators.json`

```jsonc
{
  "sp500": {
    "name": "S&P 500",
    "adapter": "fred",              // fred | factset-pdf | stockanalysis
    "config": { "seriesId": "SP500" },
    "frequency": "daily",           // daily | weekly | monthly
    "unit": "index",                // index | percent | usd | ratio
    "source": "S&P Dow Jones Indices LLC via FRED",
    "copyright": "restricted",      // none | restricted (要出所明記・再配布注意)
    "group": "equity",
    "historyLimit": "10y"           // FRED の S&P 500 は 10 年上限
  },
  "t10yie": {
    "name": "期待インフレ率 (10年BEI)",
    "adapter": "fred",
    "config": { "seriesId": "T10YIE" },
    "frequency": "daily", "unit": "percent",
    "source": "FRED", "copyright": "none", "group": "rates"
  }
  // 新指標の追加は FRED 系ならこのファイルに 1 エントリ足すだけ (コード変更なし)
}
```

### 3-3. 観測値 `data/observations/{indicatorId}.json`

```jsonc
{
  "indicatorId": "sp500",
  "updatedAt": "2026-08-16T01:00:00Z",
  "observations": {
    "2026-08-14": 7785.76,
    "2026-08-13": 7760.12
    // 日付 → 値。日付が一意キーなので UPSERT が自明に冪等になる
  }
}
```

**冪等性**: 観測日をオブジェクトのキーにするため、同じ週に再実行しても同じキーが上書きされるだけで
重複しない (spec F-1 の受入基準を構造で保証する)。

**欠測の表現**: キーを**作らない**。`null` を入れると「取得したが値が無い」と区別できなくなる。
FactSet 休刊週など理由が分かる欠測は `data/gaps.json` に理由付きで記録する (screens の欠測表示用)。

### 3-4. 画面用ビュー `data/views/valuation.json`

観測値をそのまま配ると画面側の結合処理が重くなるため、**ビルド時に画面用へ整形**する。

```jsonc
{
  "sp500": {
    "weekly": [
      { "date": "2026-08-07", "index": 7709.96, "forwardPe": 20.0, "trailingPe": 28.2,
        "forwardEps": 385.5, "trailingEps": 273.4, "earningsYield": 5.0,
        "realRate": 2.41, "yieldSpread": 2.59, "isForwardEpsHigh": true }
    ],
    "baselines": { "pe5y": 19.9, "pe10y": 19.0, "asOf": "2026-08-07" },
    "targetYield": 3.67   // 基準益回り (設定値、F-13)
  }
}
```

導出値 (EPS・益回り・実質金利・イールドスプレッド・理論値・割高率・過去最高値フラグ) は
**ビルド時に計算して埋める**。クライアントでの再計算を避け、計算ロジックを 1 か所に集約する。

### 3-5. 設定 `data/config.json`

基準益回り (F-13) など**人が決める値**。変更履歴を配列で持つ。

```jsonc
{
  "targetYield": {
    "sp500":    [{ "value": 3.67, "from": "2026-08-16", "reason": "初期値。一般的な 4.0% を as-reported EPS 基準に調整" }],
    "nasdaq100":[{ "value": 3.27, "from": "2026-08-16", "reason": "初期値。一般的な 3.2% を調整" }]
  }
}
```

画面から変更する場合は、この配列に追記する PR を作る運用にする (v1 では手編集で可)。

### 3-6. 保持期間と容量

削除しない。試算 3 万件で数 MB。Cloudflare Pages の制限 (20,000 ファイル / 25MiB per file) に対し、
指標ごとに 1 ファイルなら余裕がある。

---

## 4. 週次バッチ設計

### 4-1. 実行タイミング

```yaml
on:
  schedule:
    - cron: '0 2 * * 6'   # UTC 土曜 02:00 = JST 土曜 11:00
  workflow_dispatch:
```

**JST 土曜「朝」ではなく午前遅めにする理由**: FactSet は金曜発行で、米国東部時間 金曜夕方
(= JST 土曜早朝) に公開される。JST 土曜 7 時などに動かすと当日号がまだ無い恐れがある。
UTC 土曜 02:00 なら米国東部 金曜 22:00 で、公開後であることがほぼ保証できる。

### 4-2. 取得順と部分失敗の扱い

1. FRED (指数・金利・期待インフレ率・VIX・為替) — 失敗したら **job 失敗**
2. FactSet PDF (PER・成長率) — **404 は欠測として正常終了**、それ以外の失敗は job 失敗
3. stockanalysis (QQQ PER) — 失敗したら job 失敗

spec F-1 の「成功分のみコミットして緑にしない」を守る。ただし **FactSet の 404 だけは例外**で、
休刊週が実在するため (2026 年は 8/14・8/21)。404 は `data/gaps.json` に理由付きで記録する。

**部分的に取れた場合もコミットはする** (取れたデータは無駄にしない)。ただし job は赤にして
通知が飛ぶようにする。「緑だが歯抜け」が最も危険なため。

### 4-3. リトライとバックオフ

- FRED: 120 req/min の制限に対し、1 回の実行で数十リクエスト。**リクエスト間に 1 秒の間隔**を置く
- HTTP 5xx / タイムアウトは**指数バックオフで最大 3 回**再試行。4xx は再試行しない (404 は欠測確定)
- 初回バックフィル (約 250 PDF) は**別ワークフロー**にし、1 件ごとに 2 秒の間隔を置く。
  実行時間の見積りは約 20 分

### 4-4. 検証 (取得後、コミット前)

silent な誤りを防ぐため、コミット前に検証する。**1 つでも落ちたら job 失敗**。

| 検証 | 内容 |
| --- | --- |
| 抽出できたか | PDF の各正規表現が 1 件ヒットしたか (0 件・複数件は失敗) |
| 範囲 | PER は 5〜60、益回り・金利は −5〜20%、指数は正の値 |
| 前週比の急変 | 前週から ±20% を超える変化は失敗にして人が確認する |
| 整合 | 終値 ÷ Forward PER = Forward EPS が再計算と一致するか |
| 欠測の連続 | FactSet が 3 週連続で欠測なら失敗 (夏季休刊は最大 2 週の実績) |

### 4-5. 失敗の可視化

job の失敗は GitHub Actions の通知で届く。加えて `data/status.json` に最終成功時刻と直近の欠測を
書き出し、画面のヘッダー (screens N-1) に表示する。**画面を見れば鮮度が分かる**状態にする。

---

## 5. 秘密情報の取り扱い

public リポジトリであることを前提に、**クライアントに秘密情報を一切出さない**設計にする。

| 秘密情報 | 置き場所 | 使う場所 |
| --- | --- | --- |
| FRED API キー | GitHub Actions Secrets (`FRED_API_KEY`) | バッチのみ |

- **これ以外に秘密情報が無い**。FactSet PDF と stockanalysis は認証不要、配信は静的 JSON なので
  DB のキーも不要
- Actions のログに値が出ないようにする (`echo` しない、`set -x` を使わない)。
  **public リポの Actions ログは誰でも読める**
- `.claude/hooks/block-secrets.sh` が `.env` 系への書き込みを既にブロックしている
- 取得したデータ自体は秘密ではないが、**S&P 500 / NASDAQ / FactSet は著作権付き**のため
  spec F-11 の出所表示を実装する

---

## 6. spec / screens の未確定事項の解消

| ID | 内容 | 本 plan での結論 |
| --- | --- | --- |
| U-2 | 技術スタック | 2 節で確定 (Next.js 静的 + Recharts + Cloudflare Pages + Git 内 JSON) |
| U-3 | 非機能要件の暫定値 | 静的 CDN 配信のため p95 3 秒は容易に満たす。バッチ 5 分以内も通常回は妥当 (バックフィルのみ 20 分) |
| U-9 | stockanalysis の構造変更追従 | 4-4 の検証で「抽出 0 件なら失敗」とし、silent な破損を防ぐ |
| U-S1 | VIX の補助線 | **引かない**。恣意的な閾値になるため。将来引く場合は出所を示す |
| U-S3 | 欠測週の前週比 | **前々週との比較に落とし、「2 週前比」と明示**する。非表示にすると変化を見逃すため |
| U-S4 | チャートライブラリ | Recharts で要件を満たすことを確認 (2-3 節) |
| U-11 | 夏季休刊の年による差 | 4-2 で 404 を欠測扱いにし、4-4 で 3 週連続なら失敗とする |

**未解消のまま Step 3 へ送るもの**: U-1 (FRED API キー取得、ユーザー作業)、U-6 (PCE を v1 に含めるか)、
U-7 / U-S2 (利用規約の文面)、U-8 (削除要請時の運用)。

---

## 7. ADR 一覧

| ADR | 判断 |
| --- | --- |
| [0001](adr/0001-git-json-over-supabase.md) | データストアに Supabase ではなく Git 内 JSON を採用 |
| [0002](adr/0002-nextjs-static-export.md) | フロントは Next.js 静的エクスポート、ホスティングは Cloudflare Pages |
| [0003](adr/0003-recharts.md) | チャートライブラリに Recharts を採用 |
| [0004](adr/0004-indicator-master-schema.md) | 指標マスタ + 観測値の縦持ちスキーマ |
