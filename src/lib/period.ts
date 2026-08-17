/**
 * 期間フィルター (spec F-6)。
 *
 * 選択は URL クエリ `?period=5y` に載せる。リロード・画面遷移・共有リンクで
 * 状態が飛ばないようにするため (screens UI/UX 方針 5)。
 */

export const PERIODS = ['1y', '3y', '5y', 'all'] as const;

export type Period = (typeof PERIODS)[number];

/** 既定値。最初に見るときは直近 1 年が扱いやすい。 */
export const DEFAULT_PERIOD: Period = '1y';

export const PERIOD_LABELS: Record<Period, string> = {
  '1y': '1年',
  '3y': '3年',
  '5y': '5年',
  all: '全期間',
};

/** クエリ文字列から期間を読む。未知の値は既定値に落とす (URL を手で編集されても壊れない)。 */
export function parsePeriod(value: string | null | undefined): Period {
  if (typeof value !== 'string') return DEFAULT_PERIOD;
  const normalized = value.toLowerCase();
  return (PERIODS as readonly string[]).includes(normalized)
    ? (normalized as Period)
    : DEFAULT_PERIOD;
}

/**
 * 期間の開始日 ("YYYY-MM-DD") を返す。`all` は下限なしなので null。
 *
 * 基準日を引数で受け取り、現在時刻に依存させない。テスト可能にするためと、
 * ビルド時とクライアントで結果がずれるのを防ぐため。
 */
export function periodStartDate(period: Period, today: Date): string | null {
  if (period === 'all') return null;

  const years = Number.parseInt(period, 10);
  const start = new Date(
    Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()),
  );
  return start.toISOString().slice(0, 10);
}

/** 観測日の配列を期間で絞る。日付は "YYYY-MM-DD" の文字列比較で足りる。 */
export function filterByPeriod<T extends { date: string }>(
  points: readonly T[],
  period: Period,
  today: Date,
): T[] {
  const start = periodStartDate(period, today);
  if (start === null) return [...points];
  return points.filter((point) => point.date >= start);
}

/**
 * 月次系列を期間で絞る (#74)。
 *
 * **開始日を月初に丸める。** 日付のまま比較すると期間の最初の月が落ちる
 * (例: 基準日 2026-08-17 の「1 年」は開始 2025-08-17 になり、対象月 2025-08-01 が
 * 範囲外になって 11 か月分しか残らない)。「直近 1 年 = 12 か月」を満たすため丸める。
 */
export function filterByMonth<T extends { month: string }>(
  points: readonly T[],
  period: Period,
  today: Date,
): T[] {
  const start = periodStartDate(period, today);
  if (start === null) return [...points];
  const startMonth = `${start.slice(0, 7)}-01`;
  return points.filter((point) => point.month >= startMonth);
}
