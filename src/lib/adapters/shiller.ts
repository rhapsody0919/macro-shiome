/**
 * シラーPER (CAPE) アダプタ (#291、ADR-0010)。
 *
 * Robert Shiller 本人が公開する `ie_data.xls` から取る。FRED にはシラーPERが無い
 * (ISM 新規受注指数と同じく著作権のある独自データセット)。API/JSON 経路は無く、
 * Excel (旧バイナリ形式) をそのままダウンロードして読む。
 */
import * as XLSX from 'xlsx';

/** 観測値。日付 → 値。他のアダプタと同じ形にして保存層を共通化する。 */
export type Observations = Record<string, number>;

/**
 * shillerdata.com が配布する `ie_data.xls` の URL。
 *
 * `?ver=` のキャッシュバスター無しでも 200 を返すことを実機で確認済み (ADR-0010)。
 */
const SOURCE_URL =
  'https://img1.wsimg.com/blobby/go/e5e77e0b-59d1-44d9-ab25-4763ac982e53/downloads/e27e58c1-8ae0-488c-a976-a298708c7175/ie_data.xls';

const SHEET_NAME = 'Data';
const DATE_LABEL = 'Date';
const CAPE_LABEL = 'CAPE';

export function shillerIeDataUrl(): string {
  return SOURCE_URL;
}

/**
 * Shiller の日付表記 ("YYYY.MM"、月が1桁なら "YYYY.M") を "YYYY-MM-01" に変換する。
 *
 * **月が1桁のとき小数点以下の0が省略される** (10月が `2025.1`、1月は `2025.01`)。
 * 文字列としてそのまま `.` で分割すると桁を取り違える。`toFixed(2)` で2桁に揃えてから
 * 分割することで、`2025.1` → `"2025.10"` (10月) と正しく読める (ADR-0010)。
 */
export function parseShillerDate(raw: number): string {
  const fixed = raw.toFixed(2);
  const [yearPart, monthPart] = fixed.split('.');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error(`シラーPER: 日付として解釈できない (${raw})`);
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * "Data" シートの行列から CAPE の観測値を取り出す。
 *
 * **列位置ではなくヘッダーのラベル文字列で列を特定する。** バージョンでレイアウトが
 * ずれても、ラベルが見つからなければ例外で気付ける (#66 型の「別物を黙って拾う」事故を防ぐ)。
 * ヘッダー行は「Date」と「CAPE」の両方が同じ行に現れる行として特定する
 * (上のタイトル行にも "CAPE" 単体は複数回現れるため、両方が揃う行で一意に絞る)。
 */
export function parseShillerSheet(rows: readonly unknown[][]): Observations {
  let headerRowIndex = -1;
  let dateCol = -1;
  let capeCol = -1;

  for (const [i, row] of rows.entries()) {
    const dIdx = row.findIndex((cell) => cell === DATE_LABEL);
    const cIdx = row.findIndex((cell) => cell === CAPE_LABEL);
    if (dIdx !== -1 && cIdx !== -1) {
      headerRowIndex = i;
      dateCol = dIdx;
      capeCol = cIdx;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'シラーPER: ヘッダー行 (Date と CAPE が両方揃う行) が見つからない。ファイル構造が変わった可能性がある',
    );
  }

  const observations: Observations = {};
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[dateCol];
    const rawCape = row[capeCol];
    // 脚注行 ("Oct '25/July/Aug CPI estimated" 等) は数値でないため自然に飛ばす。
    if (typeof rawDate !== 'number' || typeof rawCape !== 'number') continue;
    if (!Number.isFinite(rawCape)) continue;

    observations[parseShillerDate(rawDate)] = rawCape;
  }

  if (Object.keys(observations).length === 0) {
    throw new Error('シラーPER: CAPE の観測値を1件も抽出できなかった');
  }

  return observations;
}

/** `ie_data.xls` を取得して CAPE の観測値を返す。 */
export async function fetchShillerCape(fetchImpl: typeof fetch = fetch): Promise<Observations> {
  const response = await fetchImpl(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`シラーPER の取得に失敗 (HTTP ${response.status}): ${SOURCE_URL}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (sheet === undefined) {
    throw new Error(`シラーPER: シート "${SHEET_NAME}" が見つからない`);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return parseShillerSheet(rows);
}
