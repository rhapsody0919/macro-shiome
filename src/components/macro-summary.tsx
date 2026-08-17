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
  const curve = pickLatest(points, (p) => p.termSpread, at);
  const real = pickLatest(points, (p) => p.realRate, at);
  const mortgage = pickLatest(points, (p) => p.mortgageRate, at);
  const vix = pickLatest(points, (p) => p.vix, at);
  const usdjpy = pickLatest(points, (p) => p.usdjpy, at);

  const formatDate = (value: string | null) =>
    value === null ? null : value.replace(/-/g, '/');

  return (
    <SummaryGrid
      title="最新の状況"
      note="評価語は使わず数値と差分のみを示す。すべて週次 (金曜時点)。"
    >
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
        label="実質金利"
        value={formatPercent(real.value)}
        delta={real.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(real.stepsBack, '週')}
        asOf={formatDate(real.at)}
        note="10年債 − 期待インフレ率"
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
        label="VIX"
        value={formatNumber(vix.value, 2)}
        delta={vix.delta}
        deltaLabel={stepLabel(vix.stepsBack, '週')}
        asOf={formatDate(vix.at)}
      />
      <SummaryCard
        label="USD/JPY"
        value={formatNumber(usdjpy.value, 2)}
        delta={usdjpy.delta}
        deltaLabel={stepLabel(usdjpy.stepsBack, '週')}
        asOf={formatDate(usdjpy.at)}
      />
    </SummaryGrid>
  );
}
