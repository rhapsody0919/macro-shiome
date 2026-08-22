/**
 * ダブルボトムのパターン検出 (#256)。
 *
 * ピボット検出 (`pivots.ts`) を土台にする。オープンソースのパターン検出ツール
 * `stock-pattern` (BennyThadikaran/stock-pattern, GPLv3) の実ソース (`src/utils.py`、
 * wiki ではなくコード上の数値条件) を調査し、設計思想のみを参考にした
 * (コードは移植していない、`pivots.ts` の方針と同じ)。
 *
 * | 項目 | 条件 |
 * | --- | --- |
 * | 2 つの安値の水準 | 差が平均バー幅の 0.5 倍以内 (下記注記) |
 * | ネックライン (間の高値) | 2 つの安値より高い |
 * | A〜C 間の非破断 | 両安値の間で、より深い安値 (`bar.low`) が出ていない |
 * | C〜基準日の非破断 | 2 番目の安値の形成後、基準日まで終値が一度もネックラインを
 *                    超えず、2 番目の安値を割っていない |
 * | 出来高 | 2 番目の安値の出来高が 1 番目より少ない (**参考情報**、必須条件にしない) |
 *
 * **経路全体 (区間判定) を検証する。** 当初の実装は基準日 (最新観測日) 1 点だけを
 * 「ネックライン未満・2 番目の安値以上」で判定していたが、実データで対象 36 銘柄の
 * 58% が該当してしまっていた。過去に一度ネックラインを上抜けて反落した銘柄や、
 * 一度 2 番目の安値を割ってから戻した銘柄まで「形成中」と誤判定していたのが原因。
 * `stock-pattern` の `find_double_bottom()` は 2 番目の安値の形成以降の終値系列
 * 全体に対して「その区間の最小終値が 2 番目の安値の日と一致するか (割り込みが無いか)」
 * 「その区間の最大終値がネックライン以下か (上抜けが無いか)」を検証しており、この
 * 経路依存チェックを `isPathIntact` として反映した。1 点判定から区間判定への変更が
 * 誤検出率を下げる主因になる、という調査結果に基づく。
 *
 * **A〜C 間の非破断チェックも追加した。** `isPathIntact` は「C 形成後」しか見ておらず、
 * A と C の間により深い安値が挟まっていても弾けなかった。ダブルボトムの W 字は
 * 「その区間で最も深い 2 点が A と C であること」が前提だが、この条件が欠けていたため、
 * 実データで検証したところ検出 11/36 件中 9 件 (82%) で A-C 間により深い安値
 * (最大 16% 下、WEAT の例) が見つかった。`isRangeAboveFloor` として追加した。
 *
 * **同水準判定を平均バー幅の 0.5 倍に厳格化した。** 従来は 1.0 倍 (平均バー幅以内)
 * だったが、`stock-pattern` の実ソースは `avgBarLength * 0.5` (A〜C 区間のレンジの
 * 中央値 × 0.5) を使っている。macro-shiome は区間ごとの中央値ではなく
 * `averageBarWidth` (`pivots.ts`、全期間の平均) を共通基盤として既に使っているため、
 * 中央値そのものではなく **0.5 倍という比率だけ**を踏襲した。**一次情報の裏付けが
 * 無い二次情報 (OSS 実装) からの引用であることを明記する。**
 *
 * **ATR ベースのネックライン高さの上限は採用しなかった。** `stock-pattern` は
 * `b - c < atr * 4` でネックラインの高さをボラティリティでキャップしているが、
 * 係数 4 の根拠が同リポジトリのソースコード以外に見当たらず、新しい指標 (ATR) を
 * このためだけに導入する理由に乏しい (#52 の「恣意的な閾値を置かない」原則)。
 * 経路依存チェックだけで誤検出の主因 (58%) は解消できると判断した。
 */
import { averageBarWidth, findPivots, type Pivot } from './pivots';
import type { DoubleBottomDetection } from '../data/types';
import type { SortedBars } from './high-tight-flag';

/**
 * 2 つの安値の水準が「ほぼ同じ」とみなす許容誤差 (平均バー幅に対する比率)。
 * `stock-pattern` の実装 (`avgBarLength * 0.5`) を参考にした比率のみの引用
 * (上記ファイル先頭のコメント参照)。
 */
const LEVEL_TOLERANCE_RATIO = 0.5;

/**
 * `bars` (日付昇順) の中から、直近で形成中のダブルボトムを検出する。
 *
 * 基準日 (最新観測日) に最も近い 2 つ目の安値ピボットから遡って探索する
 * (#230/#231 と同じ「直近を優先する」設計)。
 *
 * **2 番目の安値の形成以降、基準日までの経路全体**が「ネックラインを超えず、
 * 2 番目の安値を割らない」範囲に収まっていることを要求する (`isPathIntact`、
 * 上記ファイル先頭のコメント参照)。基準日 1 点だけの判定では、既にブレイクアウト
 * 済みか、逆にさらに下落してしまったダブルボトムまで「反発の途中にある」と
 * 誤判定してしまう。
 */
export function detectDoubleBottom(bars: SortedBars): DoubleBottomDetection | null {
  const avgWidth = averageBarWidth(bars);
  if (avgWidth <= 0) return null;
  if (bars.length === 0) return null;

  const pivots = findPivots(bars);
  const lowPivots = pivots.filter((p) => p.type === 'low');
  const highPivots = pivots.filter((p) => p.type === 'high');

  for (let ci = lowPivots.length - 1; ci >= 1; ci--) {
    const c = lowPivots[ci];
    for (let ai = ci - 1; ai >= 0; ai--) {
      const a = lowPivots[ai];
      const diff = Math.abs(a.price - c.price);
      if (diff > avgWidth * LEVEL_TOLERANCE_RATIO) continue;

      const neckline = highestPivotBetween(highPivots, a.index, c.index);
      if (neckline === null) continue;
      if (neckline.price <= Math.max(a.price, c.price)) continue;
      // A〜C 間に両安値より深い安値が無いことを要求する。これが無いと、
      // 途中でさらに大きく下落した銘柄まで「2つの安値がほぼ同水準」というだけで
      // 拾ってしまう (ダブルボトムの W 字は、この区間で最も深い 2 点が A と C で
      // あることが前提)。実データで検証したところ、この条件を欠いた版では
      // 検出 11/36 件中 9 件 (82%) が A-C 間により深い安値を持っていた。
      if (!isRangeAboveFloor(bars, a.index, c.index, Math.min(a.price, c.price))) continue;
      if (!isPathIntact(bars, c.index, neckline.price, c.price)) continue;

      const aBar = bars[a.index].bar;
      const cBar = bars[c.index].bar;
      return {
        firstBottomDate: a.date,
        firstBottomPrice: a.price,
        necklineDate: neckline.date,
        necklinePrice: neckline.price,
        secondBottomDate: c.date,
        secondBottomPrice: c.price,
        bottomDiffRatio: diff / avgWidth,
        volumeDecreased: cBar.volume < aBar.volume,
      };
    }
  }
  return null;
}

/**
 * `cIndex` (2 番目の安値) の形成日から基準日 (`bars` の末尾) までの終値が、
 * すべて `cPrice` 以上 `necklinePrice` 以下に収まっているかを検証する。
 *
 * 1 点 (基準日) だけの判定では、経路の途中で一度ネックラインを上抜けて反落した
 * 銘柄や、一度 2 番目の安値を割ってから戻した銘柄まで「形成中」と誤判定して
 * しまう (ファイル先頭のコメント参照)。`cIndex` 自身の終値は安値 (`bar.low`) 以上
 * であることが OHLC の定義上保証されるため、この判定で false になることはない。
 */
function isPathIntact(
  bars: SortedBars,
  cIndex: number,
  necklinePrice: number,
  cPrice: number,
): boolean {
  for (let i = cIndex; i < bars.length; i++) {
    const close = bars[i].bar.close;
    if (close > necklinePrice) return false;
    if (close < cPrice) return false;
  }
  return true;
}

/**
 * `aIndex` から `cIndex` までの区間で、すべてのバーの安値 (`bar.low`) が `floor`
 * 以上であるかを検証する。`floor` は通常 `Math.min(a.price, c.price)`。
 *
 * A・C 自身のバーは `bar.low === floor` (どちらか一方が `floor` の由来) のため
 * この判定で false になることはない。中間のバーだけが対象。
 */
function isRangeAboveFloor(bars: SortedBars, aIndex: number, cIndex: number, floor: number): boolean {
  for (let i = aIndex; i <= cIndex; i++) {
    if (bars[i].bar.low < floor) return false;
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
