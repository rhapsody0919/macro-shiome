/**
 * ビューの数値を、画面に出す桁まで丸める (#218)。
 *
 * 導出した値は浮動小数の全桁 (最大 18 桁) で保存されていた。表示は 2 桁なので、
 * 差は読み手に届かないまま**ページ重量と日次バッチの差分だけを増やしていた**。
 * 実測で `economy.json` が gzip 42%、`market-daily.json` が 31% 減る。
 *
 * **valuation だけ丸めない。** `pnpm verify` の項目 5 が実績 EPS = 終値 ÷ 実績 PER を
 * 相対誤差 1e-9 で再計算しており、**割り算なので丸めると差が残る** (実績 EPS 222 に対し
 * 0.04 ほど)。通すには許容差を緩めるしかなく、検証の中で最も強い項目を弱めることになる。
 * gzip 29 KB で、ページ重量で効いているのは日次のビューの方。
 *
 * macro は丸めている。あちらの導出は**足し算と引き算だけ**で、入力 (10年債利回り・
 * 期待インフレ率・潜在成長率) が既に 2 桁公表なので、丸めても再計算との差は 0.000000
 * のままだった (実測)。
 */

/** 桁を細かく持つ必要があるキー。2 桁だと動きが消える。 */
const FINER_DECIMALS: Readonly<Record<string, number>> = {
  // 1.1581 → 1.16 では線が階段状になる。為替は 2 国間レートだけ桁が小さい。
  usdEur: 4,
  cnyUsd: 4,
};

const DEFAULT_DECIMALS = 2;

/**
 * オブジェクトを走査して数値を丸める。キーごとに桁を変える。
 *
 * 日付や ID の文字列はそのまま返す。`null` は欠測なので触らない。
 */
export function roundViewNumbers<T>(value: T, decimals = DEFAULT_DECIMALS): T {
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? Number(value.toFixed(decimals)) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundViewNumbers(item, decimals)) as T;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        roundViewNumbers(item, FINER_DECIMALS[key] ?? decimals),
      ]),
    ) as T;
  }
  return value;
}
