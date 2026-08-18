import type { IndexKey } from './types';

/**
 * 指数の表示名 (#58)。
 *
 * **ここが唯一の定義**。以前は 5 つのコンポーネントに同じ内容が複製されており、
 * 指数を 1 つ増やすと 8 箇所以上を直す必要があった。見落とすと画面ごとに
 * 選択肢が食い違う。指数を足すときは**このオブジェクトに 1 行**足せば、
 * 切替 UI (`IndexSwitch`)・カード見出し・ツールチップのすべてに反映される。
 */
export const INDEX_LABELS: Record<IndexKey, string> = {
  sp500: 'S&P 500',
  nasdaq100: 'NASDAQ-100',
};

/**
 * 画面に並べる順。`INDEX_LABELS` の定義順をそのまま使う。
 *
 * 別に配列を持つと 2 か所を同期させることになり、#58 で消した重複が復活する。
 */
export const INDEX_KEYS = Object.keys(INDEX_LABELS) as IndexKey[];
