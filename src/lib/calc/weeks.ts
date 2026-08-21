/**
 * 週次系列を組み立てるための日付ユーティリティ。
 *
 * 週の基準は **金曜日**。FactSet が金曜発行で、指数もその日の終値で揃えるのが自然なため。
 * 日次系列 (指数・金利) は「その日以前で直近の値」を採って週次に落とす。
 */
import type { Observations } from '../adapters/fred';

/** "YYYY-MM-DD" を UTC の Date にする。 */
export function toDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 2 つの "YYYY-MM-DD" の間の日数 (b − a)。 */
export function diffDays(a: string, b: string): number {
  return (toDate(b).getTime() - toDate(a).getTime()) / (24 * 60 * 60 * 1000);
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
/**
 * 1 年前の同月同日を返す。うるう日 (2/29) は 2/28 に丸める。
 *
 * 文字列で `2024-02-29` の年だけ引くと `2023-02-29` という存在しない日付になり、
 * `new Date` が **翌日の 3/1 にロールオーバー**する。`valueAsOf` は「無ければ過去へ遡る」
 * 設計なので、未来へ飛ばされると前年 3/1 の値を拾ってしまう (#206、実測で NASDAQ 総合が
 * 40.47% ではなく 41.41% になっていた)。
 */
export function sameDayLastYear(date: string): string {
  const previousYear = Number(date.slice(0, 4)) - 1;
  const monthDay = date.slice(5);
  return `${previousYear}-${monthDay === '02-29' ? '02-28' : monthDay}`;
}

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

/**
 * 平日を並べる ("YYYY-MM-DD"、#137)。
 *
 * 価格系列は日次で取れるため、金曜だけを見ると**その週の途中の動きが消える**。
 * 週次グリッドは「週足に丸める」のではなく「金曜の値だけを拾う」実装なので、
 * 週内の高値・安値がそもそも図に出ていなかった。
 *
 * **土日は入れない。** 市場が閉じている日は `valueAsOf` が金曜の値を繰り返すだけで、
 * 点数が 4 割増える割に情報が増えない。
 *
 * 祝日は考慮しない。取引所が休みだった日は直前の営業日の値が入る。
 */
export function weekdaysBetween(start: string, end: string): string[] {
  const cursor = toDate(start);
  const last = toDate(end);

  const result: string[] = [];
  while (cursor.getTime() <= last.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) result.push(toIso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
