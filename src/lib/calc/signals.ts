/**
 * AI要約 (#279) が使う「警告シグナル」「セクターのハイライト」の機械的判定。
 *
 * **数値・判定はここで全部決める。LLM には言語化 (note) だけをさせる** (投資家×
 * エンジニアの議論で合意した設計)。ここに無い条件を LLM が新しく作ることはない。
 * ネットワーク不要な純粋関数にして、AI呼び出しなしでテストできるようにする。
 */
import { distribution, percentileRank } from './derived';
import type { BreakoutAsset, DrawdownAsset, MacroPoint, SectorHighlight, WarningSignal } from '../data/types';

/** 過去分布を見る窓 (#271 の SPREAD_WINDOW_YEARS と同じ5年に揃える)。 */
const WARNING_WINDOW_YEARS = 5;

/** 上位/下位何%を「警告」とするか (十分位)。過去分布に対する相対基準で、絶対値の閾値は置かない。 */
const WARNING_PERCENTILE_THRESHOLD = 90;

type WarningKind =
  | { type: 'zero-line'; trigger: (value: number) => boolean }
  | { type: 'percentile'; direction: 'high' | 'low' };

interface WarningDefinition {
  id: string;
  label: string;
  extract: (point: MacroPoint) => number | null;
  kind: WarningKind;
}

const WARNING_DEFINITIONS: readonly WarningDefinition[] = [
  {
    id: 'inverted-yield-curve',
    label: '逆イールド (10年債 − 2年債)',
    extract: (p) => p.termSpread,
    // ゼロが定義上の境界 (#63)。恣意的な閾値ではない。
    kind: { type: 'zero-line', trigger: (value) => value < 0 },
  },
  {
    id: 'tight-financial-conditions',
    label: '金融環境指数 (NFCI)',
    extract: (p) => p.nfci,
    // 0が平均、正が引き締まりという定義上の境界 (#190)。
    kind: { type: 'zero-line', trigger: (value) => value > 0 },
  },
  {
    id: 'wide-credit-spread',
    label: 'ハイイールド債スプレッド',
    extract: (p) => p.hySpread,
    kind: { type: 'percentile', direction: 'high' },
  },
  {
    id: 'vix-spike',
    label: 'VIX',
    extract: (p) => p.vix,
    kind: { type: 'percentile', direction: 'high' },
  },
];

/** `today` の `years` 年前の日付 ("YYYY-MM-DD")。#271 の `buildDistribution` と同じ計算。 */
function yearsBefore(today: Date, years: number): string {
  return new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * 警告シグナルを機械的に判定する (#279)。
 *
 * `macro` は週次グリッド (`buildMacroView` の出力)。`note` は生成しない
 * (呼び出し側が LLM で埋める)。
 */
export function detectWarnings(macro: readonly MacroPoint[], today: Date): WarningSignal[] {
  const warnings: WarningSignal[] = [];
  const from = yearsBefore(today, WARNING_WINDOW_YEARS);

  for (const def of WARNING_DEFINITIONS) {
    const withValue = macro
      .map((point) => ({ date: point.date, value: def.extract(point) }))
      .filter((point): point is { date: string; value: number } => point.value !== null);
    const latest = withValue.at(-1);
    if (latest === undefined) continue;

    if (def.kind.type === 'zero-line') {
      if (!def.kind.trigger(latest.value)) continue;
      warnings.push({
        id: def.id,
        label: def.label,
        value: latest.value,
        basis: 'zero-line',
        percentile: null,
        date: latest.date,
        note: null,
      });
      continue;
    }

    const within = withValue.filter((point) => point.date >= from);
    const stats = distribution(within.map((point) => point.value));
    if (stats === null) continue;
    const percentile = percentileRank(
      within.map((point) => point.value),
      latest.value,
    );
    if (percentile === null) continue;

    const isNotable =
      def.kind.direction === 'high'
        ? percentile >= WARNING_PERCENTILE_THRESHOLD
        : percentile <= 100 - WARNING_PERCENTILE_THRESHOLD;
    if (!isNotable) continue;

    warnings.push({
      id: def.id,
      label: def.label,
      value: latest.value,
      basis: 'percentile',
      percentile,
      date: latest.date,
      note: null,
    });
  }

  return warnings;
}

/**
 * セクター/ETFのハイライトを機械的に判定する (#279)。
 *
 * 「下落率が深いだけ」の銘柄 (ナイフを掴むリスト) を除外するため、**下落率が深い
 * こと (上位1/3以内) を必須条件**にしたうえで、反転の兆候を示す以下のどちらかが
 * 重なった資産だけを対象にする (投資家×エンジニアの議論、#274 の懸念に応える)。
 *
 * - SPYに対する相対強度 (#274) がプラス (SPYより弱い下げ方をしていない)
 * - CHoCH ブレイクアウト検出 (#268/#277)
 *
 * `symbolOf` は下落率の資産 ID (`etf-*`) からブレイクアウト側の ticker symbol への
 * 変換 (`tiingo-assets.ts` と同じ対応)。純粋関数として渡し、指標マスタへの
 * 依存をこのファイルに持ち込まない。
 */
export function detectHighlights(
  drawdownAssets: readonly DrawdownAsset[],
  breakoutAssets: readonly BreakoutAsset[],
  symbolOf: (drawdownId: string) => string | null,
): SectorHighlight[] {
  const withDrawdown = drawdownAssets.filter(
    (asset): asset is DrawdownAsset & { latest: NonNullable<DrawdownAsset['latest']> } =>
      asset.latest !== null,
  );
  const ranked = [...withDrawdown].sort((a, b) => b.latest.drawdown - a.latest.drawdown);
  const deepCount = Math.ceil(ranked.length / 3);
  const deepIds = new Set(ranked.slice(0, deepCount).map((asset) => asset.id));

  const breakoutSymbols = new Set(
    breakoutAssets.filter((asset) => asset.detection !== null).map((asset) => asset.symbol),
  );

  const highlights: SectorHighlight[] = [];
  for (const asset of withDrawdown) {
    if (!deepIds.has(asset.id)) continue;

    const symbol = symbolOf(asset.id);
    const hasBreakout = symbol !== null && breakoutSymbols.has(symbol);
    const isResilient =
      asset.latestRelativeStrength !== null && asset.latestRelativeStrength.value > 0;
    if (!isResilient && !hasBreakout) continue;

    const signalCount = 1 + [isResilient, hasBreakout].filter(Boolean).length;

    highlights.push({
      id: asset.id,
      name: asset.name,
      drawdown: asset.latest.drawdown,
      relativeStrength: asset.latestRelativeStrength?.value ?? null,
      hasBreakout,
      signalCount,
      note: null,
    });
  }

  return highlights.sort((a, b) => b.signalCount - a.signalCount);
}
