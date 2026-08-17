import { formatNumber, formatPercent } from '@/lib/format';
import { pickLatest, stepLabel } from '@/lib/pick';
import type { MacroPoint } from '@/lib/data/types';
import { SummaryCard, SummaryGrid } from './summary-card';

/**
 * 市場ページの要約 (#76 / #89)。
 *
 * 各チャートまでスクロールしないと現状が分からなかったため、先頭に並べる。
 * **期間フィルターには依存しない**。常に直近の値を見せる (バリュエーション画面と同じ)。
 */
export function MarketSummary({ points }: { points: MacroPoint[] }) {
  const at = (point: MacroPoint) => point.date;
  const real = pickLatest(points, (p) => p.realRate, at);
  const curve = pickLatest(points, (p) => p.termSpread, at);
  const hy = pickLatest(points, (p) => p.hySpread, at);
  const credit = pickLatest(points, (p) => p.creditConditions, at);
  const vix = pickLatest(points, (p) => p.vix, at);

  const formatDate = (value: string | null) => (value === null ? null : value.replace(/-/g, '/'));

  return (
    <SummaryGrid
      title="最新の状況"
      note="評価語は使わず数値と差分のみを示す。すべて週次 (金曜時点)。"
    >
      <SummaryCard
        label="実質金利"
        value={formatPercent(real.value)}
        delta={real.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(real.stepsBack, '週')}
        asOf={formatDate(real.at)}
        note="名目10年債 − 期待インフレ率"
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
        label="ハイイールド債スプレッド"
        value={formatPercent(hy.value)}
        delta={hy.delta}
        deltaUnit="pt"
        deltaLabel={stepLabel(hy.stepsBack, '週')}
        asOf={formatDate(hy.at)}
        note="拡大がリスク回避"
      />
      <SummaryCard
        label="信用状況"
        value={formatNumber(credit.value, 2)}
        delta={credit.delta}
        deltaLabel={stepLabel(credit.stepsBack, '週')}
        asOf={formatDate(credit.at)}
        note="正が引き締まり。ゼロが平均"
      />
      <SummaryCard
        label="VIX"
        value={formatNumber(vix.value, 1)}
        delta={vix.delta}
        deltaLabel={stepLabel(vix.stepsBack, '週')}
        asOf={formatDate(vix.at)}
        note="金曜終値"
      />
    </SummaryGrid>
  );
}
