/**
 * 統計ダッシュボード API アダプタ (#129)。**6 つ目のデータソース。**
 *
 * 日本の経済指標は FRED では取れない。住宅着工は `HOUSTJP` が存在せず、
 * `JPNPERMITMISMEI` は 2008 年で DISCONTINUED、CPI は 2021 年で停止している。
 *
 * **`api.e-stat.go.jp` (統計 API) とは別物。** あちらは appId が必須だが、
 * こちらは登録不要と公式に明記されている。
 * https://dashboard.e-stat.go.jp/static/api
 *
 * **1 回のレスポンスに複数の系列が混ざる。** 月次・四半期・年・年度、原数値・季調値が
 * すべて同じ配列に入って返るため、`cycle` と `isSeasonal` の両方で絞らないと
 * 同じ月に 2 つ値が来る (#96 の「10年債入札に TIPS が混入」と同じ型)。
 *
 * メタ情報で確定した意味 (推測ではない):
 * - `cycle`: 1 = 月 / 2 = 四半期 (#336 で実データから確認)
 * - `isSeasonal`: 1 = 原数値 / 2 = 季調値
 * - `isProvisional`: 0 = 確報
 */
import type { Observations } from './fred';

const BASE_URL = 'https://dashboard.e-stat.go.jp/api/1.0/Json/getData';

/** 全国。地域別は扱わない。 */
const NATIONAL = '00000';

export type EstatCycle = '1' | '2';
export type EstatSeasonal = '1' | '2';

export interface EstatQuery {
  indicatorCode: string;
  cycle: EstatCycle;
  isSeasonal: EstatSeasonal;
}

export function estatDashboardUrl(query: EstatQuery): string {
  const params = new URLSearchParams({
    Lang: 'JP',
    IndicatorCode: query.indicatorCode,
    RegionCode: NATIONAL,
    Cycle: query.cycle,
  });
  return `${BASE_URL}?${params.toString()}`;
}

interface DashboardValue {
  '@time'?: unknown;
  '@cycle'?: unknown;
  '@isSeasonal'?: unknown;
  '@indicator'?: unknown;
  $?: unknown;
}

/**
 * `YYYYMM00` を `YYYY-MM-01` に直す。
 *
 * **年度は `2025FY00` の形で混ざる。** 数字 6 桁 + `00` に一致しないものは月次ではないので
 * 弾く。`cycle` での絞り込みと二重に効かせる (どちらか一方に頼らない)。
 */
export function toMonthlyDate(time: string): string | null {
  const m = time.match(/^(\d{4})(\d{2})00$/);
  if (m === null) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

/**
 * 四半期の `2026|2Q|00` を**その期の最終月**に直す (#336)。
 *
 * 例: `20262Q00` (2026年4〜6月期) → `2026-06-01`。
 * BSI (e-Stat 統計 API、#226) が四半期の値をその期の最終月に置くのと同じ規約。
 * 月次の形式 (`YYYYMM00`) や年度 (`2025FY00`) に一致しないものは弾く。
 */
export function toQuarterlyDate(time: string): string | null {
  const m = time.match(/^(\d{4})([1-4])Q00$/);
  if (m === null) return null;
  const lastMonth = Number(m[2]) * 3;
  return `${m[1]}-${String(lastMonth).padStart(2, '0')}-01`;
}

/** 応答から観測値を取り出す。条件に合う行が 1 件も無ければ失敗させる。 */
export function parseDashboardData(body: unknown, query: EstatQuery): Observations {
  const root = (body as Record<string, unknown> | null)?.['GET_STATS'];
  const stats = (root as Record<string, unknown> | undefined)?.['STATISTICAL_DATA'];
  const dataInf = (stats as Record<string, unknown> | undefined)?.['DATA_INF'];
  const rows = (dataInf as Record<string, unknown> | undefined)?.['DATA_OBJ'];

  if (!Array.isArray(rows)) {
    const message = errorMessage(root);
    throw new Error(
      `統計ダッシュボード: データが取れなかった (${query.indicatorCode})${message}`,
    );
  }

  const observations: Observations = {};
  for (const row of rows) {
    const value = (row as Record<string, unknown>)?.['VALUE'] as DashboardValue | undefined;
    if (value === undefined) continue;
    if (String(value['@cycle']) !== query.cycle) continue;
    if (String(value['@isSeasonal']) !== query.isSeasonal) continue;

    const date =
      query.cycle === '2'
        ? toQuarterlyDate(String(value['@time']))
        : toMonthlyDate(String(value['@time']));
    if (date === null) continue;

    const parsed = Number(value.$);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `統計ダッシュボード: 値が数値でない (${query.indicatorCode} @${date}: ${String(value.$)})`,
      );
    }
    observations[date] = parsed;
  }

  if (Object.keys(observations).length === 0) {
    throw new Error(
      `統計ダッシュボード: 条件に合う観測が 0 件 (${query.indicatorCode}` +
        ` cycle=${query.cycle} isSeasonal=${query.isSeasonal})。系列の構成が変わった可能性がある`,
    );
  }
  return observations;
}

function errorMessage(root: unknown): string {
  const result = (root as Record<string, unknown> | undefined)?.['RESULT'];
  const message = (result as Record<string, unknown> | undefined)?.['errorMsg'];
  return typeof message === 'string' ? `: ${message}` : '';
}

export async function fetchEstatIndicator(query: EstatQuery): Promise<Observations> {
  const url = estatDashboardUrl(query);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`統計ダッシュボードの取得に失敗 (HTTP ${response.status}): ${url}`);
  }
  return parseDashboardData(await response.json(), query);
}
