import { formatNumber, formatPercent } from '@/lib/format';
import { pickLatest, stepLabel } from '@/lib/pick';
import type { MacroPoint } from '@/lib/data/types';
import { SummaryCard, SummaryGrid } from './summary-card';

/**
 * マクロ画面の要約 (#76)。
 *
 * 4 チャートをスクロールしないと現状が分からなかったため、主要な週次指標を先頭に並べる。
 * **期間フィルターには依存しない**。常に直近の値を見せる (バリュエーション画面と同じ)。
 */
export function MacroSummary({ points }: { points: MacroPoint[] }) {
  const at = (point: MacroPoint) => point.date;
  const postings = pickLatest(points, (p) => p.newJobPostings, at);
  const claims = pickLatest(points, (p) => p.initialClaims, at);
  const curve = pickLatest(points, (p) => p.termSpread, at);
  const mortgage = pickLatest(points, (p) => p.mortgageRate, at);
  const hy = pickLatest(points, (p) => p.hySpread, at);

  const formatDate = (value: string | null) =>
    value === null ? null : value.replace(/-/g, '/');

  return (
    <SummaryGrid
      title="最新の状況"
      note="評価語は使わず数値と差分のみを示す。すべて週次 (金曜時点)。"
    >
      <SummaryCard
        label="新規求人 (Indeed)"
        value={formatNumber(postings.value, 1)}
        delta={postings.delta}
        deltaLabel={stepLabel(postings.stepsBack, '週')}
        asOf={formatDate(postings.at)}
        note="2020年2月 = 100"
      />
      <SummaryCard
        label="新規失業保険申請"
        value={claims.value === null ? '—' : `${Math.round(claims.value / 1000)}千件`}
        delta={claims.delta === null ? null : Math.round(claims.delta / 1000)}
        deltaUnit="千件"
        deltaLabel={stepLabel(claims.stepsBack, '週')}
        asOf={formatDate(claims.at)}
        note="増加が悪化"
      />
      <SummaryCard
        label="イールドカーブ"
        value={formatPercent(curve.value)}
        delta={curve.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(curve.stepsBack, '週')}
        asOf={formatDate(curve.at)}
        note="10年 − 2年。負で逆イールド"
      />
      <SummaryCard
        label="住宅ローン金利"
        value={formatPercent(mortgage.value)}
        delta={mortgage.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(mortgage.stepsBack, '週')}
        asOf={formatDate(mortgage.at)}
        note="30年固定"
      />
      <SummaryCard
        label="ハイイールド債スプレッド"
        value={formatPercent(hy.value)}
        delta={hy.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(hy.stepsBack, '週')}
        asOf={formatDate(hy.at)}
        note="拡大がリスク回避"
      />
    </SummaryGrid>
  );
}
