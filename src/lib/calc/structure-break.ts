/**
 * 市場構造のブレイク検出の共有ロジック (#268 #272)。
 *
 * Smart Money Concepts (SMC/ICT) の BOS (Break of Structure) と CHoCH
 * (Change of Character) は、どちらも同じ 3 点構造 [1つ目の安値 (L1) → 戻り高値 (H1) →
 * 2つ目の安値 (L2)] から、終値が H1 を上抜けたかどうかを見る点で共通する
 * (`joshyattridge/smart-money-concepts`, GitHub, MIT ライセンス, `bos_choch()` を参考)。
 * 違いは L2 が L1 より高いか低いかだけ (トレンド継続か転換か)。
 *
 * この共有部分 (構造の抽出とブレイクの検出) をここに切り出し、`choch.ts`/`bos.ts` は
 * トレンド方向の判定だけを行う。
 */
import type { OhlcvBar } from '../data/types';
import type { SortedBars } from './bars';
import { findSwings } from './swing';

/**
 * スイング判定に使う既定の前後本数 (#285 で 50→8 に再較正)。
 *
 * 一次情報のデフォルト値 (50) は当初そのまま採用していた (#268) が、2年分の
 * バックフィル (#249) 後に実データで検証したところ、日次バーに対して疎すぎることが
 * 分かった。SPY (501本) では swingLength=50 だとスイングが2年間でわずか4点しか
 * 確定せず、検出される構造が390日を超えるスパンになる (「1年以上前の安値からの
 * 一本調子の上昇」を言い換えているだけで、SMC/ICTが意図する局所的な構造変化を
 * 捉えられていない)。一次情報 (`joshyattridge/smart-money-concepts`) は
 * Sydney/Tokyo/London のキルゾーンのような分足FXトレード向けの機能も持ち、
 * デフォルト値はそちら向けに調整されている可能性が高い。
 *
 * #268 と同じ手法 (候補を実データで比較し検出数が偏らないことを確認) にスパン長の
 * 指標を追加して再検証した (36銘柄、2年分)。
 *
 * | swingLength | 検出数 (CHoCH+BOS) | 平均スイング数/銘柄 | スパン平均(日) | スパン最大(日) |
 * | --- | --- | --- | --- | --- |
 * | 5   | 18 | 49.4 | 36  | 65  |
 * | 8   | 18 | 31.3 | 56  | 94  |
 * | 15  | 16 | 16.0 | 100 | 154 |
 * | 50  | 18 | 4.3  | 345 | 477 |
 *
 * 検出総数は5〜50のどの候補でも16〜18件で偏らない (#268の基準を維持)。8はその中で
 * スパンを局所的に保ちつつ (最大94日)、CHoCHが0件にならない最小の候補だった
 * (5だとCHoCHが0件になり、下落構造の反転シグナルを一切拾えなくなる)。
 */
export const DEFAULT_SWING_LENGTH = 8;

export interface StructureBreak {
  /** 1 つ目の安値 (下落構造の起点)。 */
  firstLowDate: string;
  firstLowPrice: number;
  /** 戻り高値。これを終値が上抜けたことを検出する。 */
  priorHighDate: string;
  priorHighPrice: number;
  /** 2 つ目の安値。 */
  secondLowDate: string;
  secondLowPrice: number;
  /** 戻り高値を終値が上抜けた日。 */
  breakoutDate: string;
  breakoutPrice: number;
  /** スイング判定に使った前後本数。 */
  swingLength: number;
}

/**
 * `bars` (日付昇順) の中から、直近の [1つ目の安値 (L1) → 戻り高値 (H1) → 2つ目の安値 (L2)]
 * の3点構造の後、終値が H1 を上抜けた最初の足を検出する。
 *
 * **トレンドの向き (L2 が L1 より高いか低いか) は判定しない** — それは呼び出し側
 * (`choch.ts`/`bos.ts`) の責務。
 *
 * 一次情報の実装はスイング点全体をバッチで解析し「2 番目の安値がスイングとして
 * 確定した時点」で判定するが、日次バッチ (未来のデータを持たない) では
 * `findSwings` の前後判定の性質上、2 番目の安値がスイングとして確定するのに
 * その後 `swingLength` 本の観測が要る。**上抜けの確認自体はスイング確定を待たず、
 * 2 番目の安値の直後から基準日まで全バーを対象に行う** — 「戻り高値を超えたか」は
 * 終値の水準比較だけで判定でき、上抜けた足がスイングになるのを待つ理由が無いため。
 */
export function findStructureBreak(
  bars: SortedBars,
  swingLength: number,
): StructureBreak | null {
  const swings = findSwings(bars, swingLength);

  let secondLowSwingIndex = -1;
  for (let i = swings.length - 1; i >= 0; i--) {
    if (swings[i]!.type === 'low') {
      secondLowSwingIndex = i;
      break;
    }
  }
  if (secondLowSwingIndex < 2) return null;

  const secondLow = swings[secondLowSwingIndex]!;
  const priorHigh = swings[secondLowSwingIndex - 1]!;
  const firstLow = swings[secondLowSwingIndex - 2]!;

  for (let i = secondLow.index + 1; i < bars.length; i++) {
    const bar: OhlcvBar = bars[i]!.bar;
    if (bar.close > priorHigh.price) {
      return {
        firstLowDate: firstLow.date,
        firstLowPrice: firstLow.price,
        priorHighDate: priorHigh.date,
        priorHighPrice: priorHigh.price,
        secondLowDate: secondLow.date,
        secondLowPrice: secondLow.price,
        breakoutDate: bars[i]!.date,
        breakoutPrice: bar.close,
        swingLength,
      };
    }
  }

  return null;
}

/**
 * 出来高の確認に使う平均出来高の基準期間 (#277)。
 *
 * IBD (investors.com "THE 3 MOST PROFITABLE STOCK CHART PATTERNS") が
 * カップウィズハンドル・フラットベースの買いシグナルで共通して使う基準期間。
 * #251/#254 でカップウィズハンドルの条件を見直した際も同じ一次情報を引用した。
 */
export const VOLUME_LOOKBACK_DAYS = 50;

/** ブレイクアウト日の出来高が平均に対して必要な倍率 (IBD の基準、40% 増)。 */
export const VOLUME_CONFIRMATION_MULTIPLIER = 1.4;

/**
 * ブレイクアウト日の出来高が確認できるか (#277)。
 *
 * ブレイクアウト日の出来高が、**その日を含まない直近 `VOLUME_LOOKBACK_DAYS` 日**の
 * 平均出来高より `VOLUME_CONFIRMATION_MULTIPLIER` 倍以上あれば確認できたとする。
 * ブレイクアウト当日を平均に含めると、当日自身の急増が基準を押し上げてしまう。
 *
 * 基準期間分の観測が無ければ判定できない。**標本不足で誤解を招く判定をしない**
 * (#102 と同じ原則) — 呼び出し側は `null` を「確認できない (検出しない)」として扱う。
 */
export function hasVolumeConfirmation(bars: SortedBars, breakoutDate: string): boolean | null {
  const breakoutIndex = bars.findIndex((entry) => entry.date === breakoutDate);
  if (breakoutIndex === -1) return null;

  const from = breakoutIndex - VOLUME_LOOKBACK_DAYS;
  if (from < 0) return null;
  const window = bars.slice(from, breakoutIndex);

  const avgVolume = window.reduce((sum, entry) => sum + entry.bar.volume, 0) / window.length;
  if (avgVolume <= 0) return null;

  const breakoutVolume = bars[breakoutIndex]!.bar.volume;
  return breakoutVolume >= avgVolume * VOLUME_CONFIRMATION_MULTIPLIER;
}
