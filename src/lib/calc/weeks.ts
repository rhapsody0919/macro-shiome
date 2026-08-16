/**
 * 週次系列を組み立てるための日付ユーティリティ。
 *
 * 週の基準は **金曜日**。FactSet が金曜発行で、指数もその日の終値で揃えるのが自然なため。
 * 日次系列 (指数・金利) は「その日以前で直近の値」を採って週次に落とす。
 */
import type { Observations } from '../adapters/fred';

/** "YYYY-MM-DD" を UTC の Date にする。 */
function toDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** start 以降 end 以前の金曜日をすべて返す (昇順)。 */
export function fridaysBetween(start: string, end: string): string[] {
  const cursor = toDate(start);
  const last = toDate(end);

  // 最初の金曜まで進める (金曜 = 5)。
  const offset = (5 - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + offset);

  const result: string[] = [];
  while (cursor.getTime() <= last.getTime()) {
    result.push(toIso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return result;
}

/**
 * 指定日以前で直近の観測値を返す。
 *
 * 日次系列には休場日の欠測があるため、金曜が休場なら木曜の値を使う。
 * `maxLookbackDays` を超えて遡らないのは、古い値を「その週の値」として
 * 使い回すと欠測が見えなくなるため。
 */
export function valueAsOf(
  observations: Observations,
  date: string,
  maxLookbackDays = 7,
): number | null {
  const cursor = toDate(date);
  for (let i = 0; i <= maxLookbackDays; i++) {
    const key = toIso(cursor);
    const value = observations[key];
    if (value !== undefined) return value;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return null;
}

/**
 * 指定日「ちょうど」の観測値を返す。
 *
 * 週次系列 (FactSet) は発行日が確定しているため、遡って別の週の値を拾わせない。
 * 遡ると休刊週が前週の値で埋まってしまい、欠測が見えなくなる。
 */
export function valueOn(observations: Observations, date: string): number | null {
  return observations[date] ?? null;
}
