import { formatNumber, formatPercent } from '@/lib/format';
import { pickLatest, stepLabel } from '@/lib/pick';
import type { DailyPoint } from '@/lib/data/daily-series';
import type { MonthlyPoint } from '@/lib/data/types';
import { SummaryCard, SummaryGrid } from './summary-card';

/** "2026-06-01" → "2026年6月"。日付まで出すと発表日と誤解される。 */
function formatMonth(month: string | null): string | null {
  if (month === null) return null;
  const [year, m] = month.split('-');
  return `${year}年${Number.parseInt(m, 10)}月`;
}

/** "2026-08-19" → "2026/08/19"。 */
function formatDate(date: string | null): string | null {
  return date === null ? null : date.replace(/-/g, '/');
}

/**
 * 日本ページの要約 (#186)。
 *
 * **問いごとに 1 指標**を並べる (#89)。ページの見出し (問い) と同じ順序なので、
 * 気になったカードから対応するセクションを探せる。
 *
 * **カードごとに頻度と時点が違う。** 日経平均は日次、他は月次。月次の中でも
 * 発表ラグが違い、企業物価だけ 1 か月先行する。揃っているように見せてはいけない (#64)。
 *
 * #152 で作ったときはチャートが 4 枚しかなく「同じ数字を 2 回出すだけ」として置かなかった。
 * 17 枚に増えて**開いた時点では何も分からない**状態になったため追加した。
 */
export function JapanSummary({
  monthly,
  daily,
}: {
  monthly: MonthlyPoint[];
  /** 日次系列。「日本市場はどう動いているか」だけ日次のため受け取る。 */
  daily: readonly DailyPoint[];
}) {
  const atMonth = (point: MonthlyPoint) => point.month;
  const di = pickLatest(monthly, (p) => p.jpDiLeading, atMonth);
  const cpi = pickLatest(monthly, (p) => p.jpCpiCore, atMonth);
  const wage = pickLatest(monthly, (p) => p.jpRealWage, atMonth);
  const account = pickLatest(monthly, (p) => p.jpCurrentAccount, atMonth);
  const nikkei = pickLatest(daily, (p) => p.nikkei225 ?? null, (p) => p.date);
  const housing = pickLatest(monthly, (p) => p.jpHousingStarts, atMonth);

  return (
    <SummaryGrid
      title="最新の状況"
      note="問いごとに 1 指標。評価語は使わず数値と差分のみを示す。時点は指標ごとに違う (頻度と発表時期が異なるため)。"
    >
      <SummaryCard
        label="景気動向指数 (先行)"
        value={formatNumber(di.value, 1)}
        delta={di.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(di.stepsBack, '月')}
        asOf={formatMonth(di.at)}
        note="景気は減速しているか。2020年平均 = 100"
      />
      <SummaryCard
        label="消費者物価 コア"
        value={formatPercent(cpi.value)}
        delta={cpi.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(cpi.stepsBack, '月')}
        asOf={formatMonth(cpi.at)}
        note="物価は落ち着くか。生鮮食品を除く総合の前年同月比"
      />
      <SummaryCard
        label="実質賃金指数"
        value={formatNumber(wage.value, 1)}
        delta={wage.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(wage.stepsBack, '月')}
        asOf={formatMonth(wage.at)}
        note="雇用と所得は保つか。季節調整済み"
      />
      <SummaryCard
        label="経常収支"
        value={formatNumber(account.value, 0)}
        valueUnit="億円"
        delta={account.delta}
        deltaLabel={stepLabel(account.stepsBack, '月')}
        asOf={formatMonth(account.at)}
        note="海外との取引は円を支えるか。季節調整済み"
      />
      <SummaryCard
        label="日経平均株価"
        value={formatNumber(nikkei.value, 0)}
        delta={nikkei.delta}
        deltaLabel={stepLabel(nikkei.stepsBack, '日')}
        asOf={formatDate(nikkei.at)}
        note="日本市場はどう動いているか。日次"
      />
      <SummaryCard
        label="新設住宅着工戸数"
        value={formatNumber(housing.value, 0)}
        valueUnit="戸"
        delta={housing.delta}
        deltaLabel={stepLabel(housing.stepsBack, '月')}
        asOf={formatMonth(housing.at)}
        note="住宅は動いているか。季調済年率換算"
      />
    </SummaryGrid>
  );
}
