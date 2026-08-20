/**
 * 米財務省 Fiscal Data アダプタ (#96)。
 *
 * 国債入札の結果を取る。**API キー不要・無料**で、レート制限の記載も無い
 * (週次に 1 回しか叩かないので、あっても問題にならない)。
 *
 * 応札倍率 (bid-to-cover) = 応札額 ÷ 落札額。**低いほど買い手が弱い**ことを示し、
 * 「入札が低調 → 金利上昇圧力」という経路で財政収支 (#87) の下流にあたる。
 *
 * 判断の記録は `docs/adr/0006-treasury-auctions.md`。
 */

import type { AvgRateId } from '../data/types';

const API_ROOT = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const BASE_URL = `${API_ROOT}/v1/accounting/od/auctions_query`;
const AVG_RATE_URL = `${API_ROOT}/v2/accounting/od/avg_interest_rates`;
const DEBT_URL = `${API_ROOT}/v2/accounting/od/debt_to_penny`;

/** 観測値。日付 (入札日) → 値。FRED アダプタと同じ形にして保存層を共通化する。 */
export type Observations = Record<string, number>;

/**
 * 10 年債 (物価連動でない通常債) を特定する条件。
 *
 * **3 つとも要る**。実データで確認した落とし穴:
 *
 * - `security_term` だけだと**リオープン (追加発行) が漏れる**。リオープンは
 *   「9-Year 10-Month」のように残存期間で記録されるため。
 *   `original_security_term` なら発行時の年限で拾える
 * - `inflation_index_security` を見ないと **10 年 TIPS が混ざる**。同じ
 *   security_type / original_security_term を持ち、利回りだけ 2% 台になる
 *   (2026-07-23 の 2.438% が該当)
 */
const TEN_YEAR_NOTE_FILTER =
  'security_type:eq:Note,original_security_term:eq:10-Year,inflation_index_security:eq:No';

interface AuctionRecord {
  auction_date?: unknown;
  bid_to_cover_ratio?: unknown;
  inflation_index_security?: unknown;
}

export interface TreasuryClientOptions {
  fetchImpl?: typeof fetch;
  /** 1 ページあたりの件数。既定で全期間 (2026 年時点で 360 件) を 1 回で取り切る。 */
  pageSize?: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function tenYearAuctionUrl(pageSize: number): string {
  const params = new URLSearchParams({
    filter: TEN_YEAR_NOTE_FILTER,
    fields: 'auction_date,bid_to_cover_ratio,inflation_index_security',
    sort: '-auction_date',
  });
  // page[size] は URLSearchParams が角括弧をエンコードするため手で足す。
  return `${BASE_URL}?${params.toString()}&page%5Bsize%5D=${pageSize}`;
}

/**
 * レスポンスから応札倍率を取り出す。
 *
 * **想定外の形は握りつぶさずに落とす**。silent に空を返すと「入札が無かった」と
 * 区別できず、欠測として静かに蓄積する。
 */
export function parseAuctions(body: unknown): Observations {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('財務省 API: data フィールドが無い');
  }
  const rows = (body as { data: unknown }).data;
  if (!Array.isArray(rows)) {
    throw new Error('財務省 API: data が配列でない');
  }

  const observations: Observations = {};
  for (const row of rows as AuctionRecord[]) {
    const date = row.auction_date;
    const ratio = row.bid_to_cover_ratio;
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
      throw new Error(`財務省 API: auction_date が不正 (${String(date)})`);
    }
    // フィルタが効いていることを受信側でも確かめる。TIPS が混ざると別物になる。
    if (row.inflation_index_security !== 'No') {
      throw new Error(`財務省 API: 物価連動債が混ざっている (${date})`);
    }
    // **1999 年 11 月より前の入札は応札倍率が記録されていない** (実データで確認、81 件)。
    // これはデータ提供の境界であって破損ではないので、欠測として飛ばす。
    if (ratio === 'null' || ratio === '' || ratio === null) continue;
    if (typeof ratio !== 'string' && typeof ratio !== 'number') {
      throw new Error(`財務省 API: bid_to_cover_ratio が不正 (${date})`);
    }
    const value = Number(ratio);
    if (!Number.isFinite(value)) {
      throw new Error(`財務省 API: bid_to_cover_ratio が数値でない (${date}: ${String(ratio)})`);
    }
    // 同じ日に複数記録があれば後勝ち。10 年債は月 1 回なので実際には起きない。
    observations[date] = value;
  }

  if (Object.keys(observations).length === 0) {
    throw new Error('財務省 API: 入札が 1 件も取れなかった');
  }
  return observations;
}

export class TreasuryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly pageSize: number;

  constructor(options: TreasuryClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.pageSize = options.pageSize ?? 1000;
  }

  /** 10 年債 (通常債) の応札倍率を入札日ごとに返す。 */
  async fetchTenYearBidToCover(): Promise<Observations> {
    return parseAuctions(await this.getJson(tenYearAuctionUrl(this.pageSize)));
  }

  /** 国債の平均利率を月ごとに返す (#222)。 */
  async fetchAvgRate(id: AvgRateId): Promise<Observations> {
    const series = AVG_RATE_SERIES[id];
    return parseAvgRates(await this.getJson(avgRateUrl(series, this.pageSize)), series);
  }

  /** 市中保有の国債残高を日ごとに返す (#222)。兆ドル単位。 */
  async fetchDebtHeldByPublic(): Promise<Observations> {
    // 1993 年以降の日次で 8,374 件あるため既定のページ数では足りない。
    // **10,000 が API の上限** (20,000 は HTTP 400、実測)。全期間が 1 回で取り切れる。
    return parseDebt(await this.getJson(debtUrl(10_000)));
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`財務省 API の取得に失敗 (HTTP ${response.status})`);
    }
    return response.json();
  }
}

/**
 * 国債の平均利率 (#222)。**発行済み国債が実際に払っている金利。**
 *
 * 10 年債利回りとの差が借り換え圧力を示す。既発債の平均が 3.4% で市場金利が 4% を
 * 超えているなら、借り換えが進むほど利払い費が増える。FRED にこの系列は無い。
 *
 * **1 回のレスポンスに複数の系列が混ざる** (#96 の TIPS 混入・#129 の e-Stat と同じ型)。
 * 最新月だけで 16 行返り、`security_type_desc` と `security_desc` の**両方を固定**しないと
 * 別物を掴む (Non-marketable の Domestic Series は 7.577% で桁が違う)。
 */
export interface AvgRateSeries {
  securityType: string;
  securityDesc: string;
}

export const AVG_RATE_SERIES: Record<AvgRateId, AvgRateSeries> = {
  'treasury-avg-rate': {
    securityType: 'Interest-bearing Debt',
    securityDesc: 'Total Interest-bearing Debt',
  },
  'treasury-avg-rate-bills': { securityType: 'Marketable', securityDesc: 'Treasury Bills' },
  'treasury-avg-rate-notes': { securityType: 'Marketable', securityDesc: 'Treasury Notes' },
};

export function avgRateUrl(series: AvgRateSeries, pageSize: number): string {
  const params = new URLSearchParams({
    // **両方を渡す。** 片方だけだと同じ月に複数の値が返る。
    filter: `security_type_desc:eq:${series.securityType},security_desc:eq:${series.securityDesc}`,
    fields: 'record_date,security_type_desc,security_desc,avg_interest_rate_amt',
    sort: '-record_date',
  });
  return `${AVG_RATE_URL}?${params.toString()}&page%5Bsize%5D=${pageSize}`;
}

interface AvgRateRecord {
  record_date?: unknown;
  security_type_desc?: unknown;
  security_desc?: unknown;
  avg_interest_rate_amt?: unknown;
}

/**
 * 平均利率を取り出す。**受信側でも絞り込みが効いていることを確かめる。**
 *
 * フィルタが外れると別の証券種別が混ざり、同じ月に複数の値が入る。
 * 値だけ見ても気付けないので、行ごとに種別を照合する。
 */
export function parseAvgRates(body: unknown, series: AvgRateSeries): Observations {
  const rows = requireRows(body);
  const observations: Observations = {};
  for (const row of rows as AvgRateRecord[]) {
    const date = row.record_date;
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
      throw new Error(`財務省 API: record_date が不正 (${String(date)})`);
    }
    if (row.security_type_desc !== series.securityType || row.security_desc !== series.securityDesc) {
      throw new Error(
        `財務省 API: 別の系列が混ざっている (${date}: ${String(row.security_type_desc)} / ${String(row.security_desc)})`,
      );
    }
    const value = Number(row.avg_interest_rate_amt);
    if (!Number.isFinite(value)) {
      throw new Error(`財務省 API: 平均利率が数値でない (${date}: ${String(row.avg_interest_rate_amt)})`);
    }
    if (observations[date] !== undefined) {
      throw new Error(`財務省 API: 同じ月に複数の値がある (${date})`);
    }
    observations[date] = value;
  }
  if (Object.keys(observations).length === 0) {
    throw new Error('財務省 API: 平均利率が 1 件も取れなかった');
  }
  return observations;
}

/**
 * 国債残高のうち**市中保有分** (#222)。日次。
 *
 * 合計ではなく市中保有を採る。政府内保有 (社会保障基金など) は市場に出回らないため、
 * **発行圧力を見るなら市中保有分**。両者の差は 2026-08 時点で 7.78 兆ドルある。
 */
export function debtUrl(pageSize: number): string {
  const params = new URLSearchParams({
    fields: 'record_date,debt_held_public_amt',
    sort: '-record_date',
  });
  return `${DEBT_URL}?${params.toString()}&page%5Bsize%5D=${pageSize}`;
}

interface DebtRecord {
  record_date?: unknown;
  debt_held_public_amt?: unknown;
}

export function parseDebt(body: unknown): Observations {
  const rows = requireRows(body);
  const observations: Observations = {};
  for (const row of rows as DebtRecord[]) {
    const date = row.record_date;
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
      throw new Error(`財務省 API: record_date が不正 (${String(date)})`);
    }
    // **市中保有と政府内保有の内訳は 2005-04 以降しか報告されていない** (実データで確認、
    // 1993-04-01 〜 2005-03-30 の 2,958 日が null)。提供の境界であって破損ではないので飛ばす
    // — 応札倍率が 1999 年 11 月より前に無いのと同じ扱い。
    const raw = row.debt_held_public_amt;
    if (raw === null || raw === 'null' || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`財務省 API: 残高が数値でない (${date}: ${String(raw)})`);
    }
    // 兆ドル単位で持つ。ドルのままだと 3.2e13 になり、丸め (#218) と範囲の指定が扱いにくい。
    observations[date] = value / 1e12;
  }
  if (Object.keys(observations).length === 0) {
    throw new Error('財務省 API: 国債残高が 1 件も取れなかった');
  }
  return observations;
}

function requireRows(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('財務省 API: data フィールドが無い');
  }
  const rows = (body as { data: unknown }).data;
  if (!Array.isArray(rows)) {
    throw new Error('財務省 API: data が配列でない');
  }
  return rows;
}
