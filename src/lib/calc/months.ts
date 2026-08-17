/**
 * 月次系列を組み立てるための日付ユーティリティ (#64)。
 *
 * **月次データは週次グリッドに載せない。** FRED の月次系列は「対象月の 1 日」を
 * 観測日として持つ (発表日ではない)。週次に落とすと同じ値が 4〜5 週続いて階段状になり、
 * 「先週から動いていない」のか「月次だから動かない」のか読み手が判別できなくなる。
 *
 * また**発表ラグが指標ごとに違う**。2026-08-17 時点で CPI と PPI は 7 月分まで出ているのに、
 * 輸入物価と PCE は 6 月分止まり。週次グリッドに載せるとこの差が見えなくなる。
 */
import type { Observations } from '../adapters/fred';

/** "YYYY-MM-01" 形式に正規化する。FRED の月次系列は月初を観測日にする。 */
function toMonthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * start 以降 end 以前の月初をすべて返す (昇順)。
 *
 * 日付部分は無視して月単位で刻む。
 */
export function monthsBetween(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split('-').map((p) => Number.parseInt(p, 10));
  const [endYear, endMonth] = end.split('-').map((p) => Number.parseInt(p, 10));

  const result: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

/** 12 か月前の月初を返す。 */
export function yearAgo(month: string): string {
  const [year, m] = month.split('-').map((p) => Number.parseInt(p, 10));
  return `${year - 1}-${String(m).padStart(2, '0')}-01`;
}

/**
 * 対象月の観測値を返す。**遡らない**。
 *
 * 月次系列は対象月がそのまま観測日なので、遡ると別の月の値を拾う。
 */
export function valueForMonth(observations: Observations, month: string): number | null {
  return observations[toMonthStart(month)] ?? null;
}

/**
 * 値を持つ最も新しい月を返す。発表ラグの表示に使う。
 *
 * 指標ごとに発表タイミングが違うため、系列単位で「どこまで出ているか」を示す必要がある。
 */
export function latestMonthWithValue(months: readonly string[], observations: Observations): string | null {
  for (let i = months.length - 1; i >= 0; i--) {
    if (valueForMonth(observations, months[i]) !== null) return months[i];
  }
  return null;
}
