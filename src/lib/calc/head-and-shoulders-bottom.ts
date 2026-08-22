/**
 * ヘッド・アンド・ショルダーズ・ボトム (逆三尊) のパターン検出 (#258)。
 *
 * ピボット検出 (`pivots.ts`) を土台にする。オープンソースのパターン検出ツール
 * `stock-pattern` (BennyThadikaran/stock-pattern, GPLv3) の実ソース
 * (`src/utils.py` の `is_reverse_hns`/`find_reverse_hns`、161〜222行・1267〜1400行) を
 * 調査し、設計思想のみを参考にした (コードは移植していない、`pivots.ts`/`double-bottom.ts`
 * と同じ方針)。Wiki (`Pattern-Algorithms`) には弱気 H&S の式しか無く、逆パターンの仕様は
 * ソースコードでしか確認できなかった。
 *
 * | 項目 | 条件 |
 * | --- | --- |
 * | 5点構造 | 左肩(安値) → 左ネックライン点(高値) → 頭(安値) → 右ネックライン点(高値) → 右肩(安値) |
 * | 頭の深さ | 両肩より低い、かつ「頭と右肩」の差が平均バー幅の 0.6 倍を超える |
 * | ネックラインの水平性 | 左右のネックライン点の差が平均バー幅未満 |
 * | ネックラインの位置 | 左右のネックライン点はどちらも両肩より高い |
 * | 経路の非破断 | 右肩の形成後、基準日まで終値が一度もネックラインを超えず、右肩を割っていない |
 * | 出来高 | **条件なし** (下記注記) |
 *
 * **出来高条件は追加しない。** `stock-pattern` に加えて zeta-zetra/chart_patterns,
 * white07S/TradingPatternScanner, keithorange/PatternPy の計 4 リポジトリを調査したが、
 * 逆 H&S (および弱気 H&S) に出来高条件を実装しているものは 1 つも無かった (同じ
 * `stock-pattern` 内のダブルトップ/ダブルボトムだけが Volume を使う設計)。「右肩形成時に
 * 出来高が減る」という定説は数値条件として存在しないため、`double-bottom.ts`/
 * `cup-with-handle.ts`/`high-tight-flag.ts` と異なりこの実装には出来高の参考情報も持たせない。
 *
 * **左右の肩の高さ (A vs E) を直接比較する条件は無い。** `stock-pattern` も zeta-zetra も
 * 「肩どうしの対称性」ではなく「肩と頭の高低差」または「ネックライン2点の対称性」を
 * 検証しており、教科書的に語られる「左右の肩がほぼ同じ高さ」という条件は数値式として
 * どちらの実装にも存在しない。この実装も同様に、肩どうしの対称性チェックは持たない。
 * `abs(c - e)` (頭と**右肩**の差) だけを見るのも `stock-pattern` の実装どおりで、
 * 左肩とは比較しない非対称な条件になっている。
 *
 * **未ブレイクアウト判定は `double-bottom.ts` と同じ経路依存チェックに統一した。**
 * `stock-pattern` は (1) B-D の回帰直線を F 地点まで x 軸方向に延長した値との比較
 * (`f > y` なら既にブレイクアウト済みとして棄却) (2) 形成後の最高値がネックラインを
 * 平均バー幅超えて上回っていないかの事後チェック、という2段構えだが、いずれも可変の
 * x 座標補間を要する。macro-shiome は既に `double-bottom.ts` で「対象区間の終値が
 * [下限, 上限] のコリドーに収まっているか」という単純な経路依存チェック (`isPathIntact`)
 * を採用しており、ここでも同じ設計を使う (下限=右肩の安値、上限=ネックライン=左右
 * ネックライン点の低い方)。ネックライン2点は既に「ほぼ同水準」であることを条件で
 * 要求しているため、傾きを無視して低い方の値を水平なコリドー上限とみなしても実質的な
 * 差は小さい。終値ベースのコリドーは「形成後の最高値」を直接見る `stock-pattern` の
 * 事後チェックより保守的 (安全側) になる。
 *
 * **平均バー幅は区間ごとの中央値ではなく全期間の平均を使う。** `stock-pattern` は
 * B〜D 区間のバー幅の中央値 (`avgBarLength`) を使うが、macro-shiome は `pivots.ts` の
 * `averageBarWidth` (全期間の平均) を共通基盤として既に `double-bottom.ts` で使っており、
 * ここでも同じ関数を再利用する (`double-bottom.ts` と同じ判断: 比率のみ二次情報から
 * 引用し、基準そのものは独自に統一する。**一次情報の裏付けが無い二次情報からの引用で
 * あることを明記する**)。
 */
import { averageBarWidth, findPivots, type Pivot } from './pivots';
import type { HeadAndShouldersBottomDetection } from '../data/types';
import type { SortedBars } from './high-tight-flag';

/**
 * 頭と右肩の高低差が「頭が十分深い」とみなす下限 (平均バー幅に対する比率)。
 * `stock-pattern` の `is_reverse_hns` (`abs(c - e) > avgBarLength * 0.6`) を参考にした
 * 比率のみの引用 (上記ファイル先頭のコメント参照、一次情報の裏付けは無い)。
 */
const SHOULDER_DEPTH_RATIO = 0.6;

/**
 * 左右のネックライン点が「ほぼ水平」とみなす許容誤差 (平均バー幅に対する比率)。
 * `stock-pattern` の `abs(b - d) < avgBarLength` を参考にした比率のみの引用。
 */
const NECKLINE_TOLERANCE_RATIO = 1.0;

/**
 * `bars` (日付昇順) の中から、直近で形成中のヘッド・アンド・ショルダーズ・ボトムを検出する。
 *
 * 右肩 (E、基準日に最も近い安値ピボット) から遡って探索する
 * (`double-bottom.ts`/`high-tight-flag.ts` と同じ「直近を優先する」設計)。
 *
 * **右肩の形成以降、基準日までの経路全体**が「ネックラインを超えず、右肩を割らない」
 * 範囲に収まっていることを要求する (上記ファイル先頭のコメント参照)。基準日 1 点だけの
 * 判定では、既にブレイクアウト済みか、逆にさらに下落してしまったパターンまで
 * 「反発の途中にある」と誤判定してしまう (`double-bottom.ts` と同じ問題意識)。
 */
export function detectHeadAndShouldersBottom(
  bars: SortedBars,
): HeadAndShouldersBottomDetection | null {
  if (bars.length === 0) return null;
  const avgWidth = averageBarWidth(bars);
  if (avgWidth <= 0) return null;

  const pivots = findPivots(bars);
  const lowPivots = pivots.filter((p) => p.type === 'low');
  const highPivots = pivots.filter((p) => p.type === 'high');
  if (lowPivots.length < 3) return null;

  const asOfClose = bars[bars.length - 1].bar.close;

  for (let ei = lowPivots.length - 1; ei >= 2; ei--) {
    const e = lowPivots[ei];
    if (asOfClose <= e.price) continue; // f > e (直近終値が右肩を上抜け、反発の確認)

    for (let ci = ei - 1; ci >= 1; ci--) {
      const c = lowPivots[ci];

      for (let ai = ci - 1; ai >= 0; ai--) {
        const a = lowPivots[ai];

        if (c.price >= Math.min(a.price, e.price)) continue; // 頭が両肩より低い

        const b = highestPivotBetween(highPivots, a.index, c.index);
        if (b === null) continue;
        const d = highestPivotBetween(highPivots, c.index, e.index);
        if (d === null) continue;

        if (Math.min(b.price, d.price) <= Math.max(a.price, e.price)) continue; // ネックラインは両肩より高い
        const necklineDiff = Math.abs(b.price - d.price);
        if (necklineDiff >= avgWidth * NECKLINE_TOLERANCE_RATIO) continue; // ネックラインがほぼ水平
        const shoulderDepth = Math.abs(c.price - e.price);
        if (shoulderDepth <= avgWidth * SHOULDER_DEPTH_RATIO) continue; // 頭が右肩より十分深い

        const necklinePrice = Math.min(b.price, d.price);
        if (!isPathIntact(bars, e.index, necklinePrice, e.price)) continue;

        return {
          leftShoulderDate: a.date,
          leftShoulderPrice: a.price,
          leftNecklineDate: b.date,
          leftNecklinePrice: b.price,
          headDate: c.date,
          headPrice: c.price,
          rightNecklineDate: d.date,
          rightNecklinePrice: d.price,
          rightShoulderDate: e.date,
          rightShoulderPrice: e.price,
          necklinePrice,
          necklineDiffRatio: necklineDiff / avgWidth,
          shoulderDepthRatio: shoulderDepth / avgWidth,
        };
      }
    }
  }
  return null;
}

/**
 * `eIndex` (右肩) の形成日から基準日 (`bars` の末尾) までの終値が、
 * すべて `ePrice` 以上 `necklinePrice` 以下に収まっているかを検証する。
 *
 * 1 点 (基準日) だけの判定では、経路の途中で一度ネックラインを上抜けて反落した
 * 銘柄や、一度右肩を割ってから戻した銘柄まで「形成中」と誤判定してしまう
 * (ファイル先頭のコメント参照)。`double-bottom.ts` の `isPathIntact` と同じ設計。
 */
function isPathIntact(
  bars: SortedBars,
  eIndex: number,
  necklinePrice: number,
  ePrice: number,
): boolean {
  for (let i = eIndex; i < bars.length; i++) {
    const close = bars[i].bar.close;
    if (close > necklinePrice) return false;
    if (close < ePrice) return false;
  }
  return true;
}

function highestPivotBetween(
  highPivots: readonly Pivot[],
  afterIndex: number,
  beforeIndex: number,
): Pivot | null {
  let best: Pivot | null = null;
  for (const h of highPivots) {
    if (h.index <= afterIndex || h.index >= beforeIndex) continue;
    if (best === null || h.price > best.price) best = h;
  }
  return best;
}
