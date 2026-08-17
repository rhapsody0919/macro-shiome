/**
 * 表示用のフォーマット。
 *
 * 欠測を「0」や「-」と紛らわしく出さないため、null は明示的に「—」にする。
 */

/** 欠測の表示。数値の 0 と区別できる記号を使う。 */
export const MISSING = '—';

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** % を % のまま表示する (4.68 → "4.68%")。小数表記との混在を防ぐ。 */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${value.toFixed(digits)}%`;
}

/** 符号を明示する。前週比や割高率のように向きが重要な値に使う。 */
export function formatSigned(value: number | null | undefined, digits = 2, unit = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${unit}`;
}

/** "YYYY-MM-DD" や ISO 8601 を "YYYY/MM/DD" にする。 */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value.length < 10) return MISSING;
  return value.slice(0, 10).replace(/-/g, '/');
}

/** 変化の向きを記号で示す。色だけに情報を載せないため (screens UI/UX 方針 3)。 */
export function changeMark(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '→';
  return value > 0 ? '▲' : '▼';
}
