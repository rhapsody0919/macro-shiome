# 0003. チャートライブラリに Recharts を採用

- ステータス: 採用
- 日付: 2026-08-16
- 関連: SDD Step 2、[ADR-0002](0002-nextjs-static-export.md)、screens U-S4

## 背景

`docs/screens.md` の UI 要件が、チャートライブラリの選定条件になっている。特に
**欠測の穴あけ** (線を繋がない) は spec F-10 の要件で、ライブラリ間で対応が分かれる。

必要な機能: 二軸 / 凡例トグル / 欠測の穴あけ / 基準線 (5年・10年平均、ゼロ線) /
マーカー (過去最高値) / 正負の塗り分け / 統合ツールチップ。

## 検討した選択肢

| 要件 | 案 A: Recharts | 案 B: Chart.js | 案 C: ECharts |
| --- | --- | --- | --- |
| 欠測の穴あけ | **`connectNulls: false` が既定**<sup>1</sup> | `spanGaps: false`<sup>2</sup> | `connectNulls: false` |
| 二軸 | `yAxisId` | `yAxisID` | 複数 yAxis |
| 基準線 | `ReferenceLine` (標準) | **annotation プラグインが別途必要** | markLine |
| マーカー | `ReferenceDot` (標準) | **annotation プラグイン** | markPoint |
| 正負の塗り分け | `ReferenceArea` / gradient | プラグイン頼み | visualMap |
| React 統合 | ネイティブ | ラッパーが必要 | ラッパーが必要 |

<sup>1</sup> [ソース](https://github.com/recharts/recharts/blob/master/src/cartesian/Line.tsx)の
`defaultProps` に `connectNulls: false` を確認 (2026-08-16)。
<sup>2</sup> [公式](https://www.chartjs.org/docs/latest/charts/line.html) に
"If false, points with `null` data will create a break in the line." と明記。

各案の不適合点:

- **案 A**: **凡例クリックによる系列トグルが標準に無い**。大量データ (数万点) の描画性能に劣る
- **案 B**: 基準線とマーカーが annotation プラグイン依存で、依存が 1 つ増える。React ラッパーが必要
- **案 C**: バンドルサイズが大きく、React 統合が薄い。本アプリの規模には過剰

## 決定

**Recharts を採用する。**

## 理由

1. **要件のうち欠測・基準線・マーカーが追加プラグイン無しで揃う**。Chart.js は annotation
   プラグインが必要で、依存とバージョン追従のコストが増える
2. **React ネイティブ**。ADR-0002 で Next.js を採用しており、ラッパーを挟まずに済む
3. 性能面の弱点は問題にならない。データ量は週次 10 年で数百点、日次でも数千点

## 影響・トレードオフ

- **凡例トグルは自前実装が必要**。`Legend` の `onClick` で表示状態を持ち、各系列の `hide` prop に
  反映する。数十行で済む見込み。screens の C-2 (EPS 単独モード)・C-4 (内訳トグル) で使う
- 将来 v2 でセクター別ヒートマップなど Recharts が不得手な図が必要になった場合、
  その画面だけ別ライブラリを使うか、SVG を自前で描くことを検討する
- 大量データを扱う要件が出たら ECharts を再評価する
