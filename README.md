# macro-shiome (マクロ潮目)

マクロ指標を横断して相場の潮目を読むための可視化アプリ。

主要指数 (S&P 500 / NASDAQ) とフォワード / 実績 EPS、バリュエーション (Forward P/E、
株式益回り − 10 年債利回りのイールドスプレッド) を週次で蓄積・可視化する。
将来は VIX・為替・金利・債券入札・個人消費など、証券口座のチャートでは集めづらい指標の
集約表示へ広げる。

## 構成

- 週次バッチ: GitHub Actions が毎週土曜朝 (JST) に実行 → データ取得 → Supabase へ UPSERT
- ダッシュボード: 指数 vs Forward EPS の二軸折れ線 / Forward P/E と基準線 / イールドスプレッド /
  相関サマリー (直近半年・1 年・全期間) / 期間フィルター (1 年・3 年・5 年・全期間)
- 完全無料スタックで構築する

技術スタックは未確定 (SDD Step 2 で決定し `docs/plan.md` と `docs/adr/` に記録)。

## 開発

開発フロー・規約は [CLAUDE.md](CLAUDE.md)、コードレビュー観点は [AGENTS.md](AGENTS.md) を参照。

SDD の各ステップは Claude Code のスラッシュコマンドで起動する:
`/step1-spec` → `/step1-screens` → `/step2` → `/step3` → `/step4`。
