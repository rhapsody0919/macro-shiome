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

const BASE_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query';

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
    const response = await this.fetchImpl(tenYearAuctionUrl(this.pageSize));
    if (!response.ok) {
      throw new Error(`財務省 API の取得に失敗 (HTTP ${response.status})`);
    }
    return parseAuctions(await response.json());
  }
}
