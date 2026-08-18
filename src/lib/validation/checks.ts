/**
 * 取得値の検証 (plan 4-4)。
 *
 * 金融データで最も避けたいのは「もっともらしい誤った値が静かに蓄積すること」。
 * 欠測なら気付けるが、桁違いや取り違えは気付けないまま何週間も溜まる。
 * そのため **1 つでも検証に落ちたらバッチ全体を失敗させる**。
 */
import type { Indicator, IndicatorGroup, Unit } from '../data/types';

export interface ValidationIssue {
  indicatorId: string;
  /** 対象の観測日。系列全体に関わる場合は省略。 */
  date?: string;
  rule: string;
  message: string;
}

/** 値の許容範囲。単位とグループの組み合わせで決める。 */
interface Range {
  min: number;
  max: number;
}

/**
 * 範囲の定義。
 *
 * 成長率 (valuation グループの percent) は決算シーズンに 50% を超えることがあり、
 * 減益局面では負にもなるため、金利とは別の幅を持たせる。
 */
function rangeFor(unit: Unit, group: IndicatorGroup): Range | null {
  switch (unit) {
    case 'ratio':
      // PER。5 を割るか 60 を超えるのは取り違えを疑う水準。
      return { min: 5, max: 60 };
    case 'index':
      // 指数と VIX。負にはならない。
      return { min: 0, max: Number.POSITIVE_INFINITY };
    case 'diffusion':
      // 拡散指数 (#94)。定義上 −100〜+100 に収まり、0 が「改善と悪化が同数」。
      // index より狭いので、取り違えがあれば index より早く気付ける。
      return { min: -100, max: 100 };
    case 'jpy-per-usd':
      return { min: 50, max: 300 };
    case 'percent':
      return group === 'valuation'
        ? // 増益率。過去には四半期で 90% を超えた例があり、減益局面は負になる。
          { min: -100, max: 300 }
        : // 金利・期待インフレ率・益回り。
          { min: -5, max: 20 };
  }
}

/**
 * 前週比の急変チェックを適用してよい指標か。
 *
 * 水準そのものを表す指標だけを対象にする。増益率のような「変化率を表す指標」は
 * 週次で大きく動くのが正常で (実測で 23.1% → 47.4% → 50.4%)、
 * 相対変化で見ると必ず閾値を超えてしまう。
 */
function isLevelIndicator(indicator: Indicator): boolean {
  // 月次・四半期の指標は週次グリッドに乗らない。期初がたまたま金曜の週だけ検証対象になり、
  // 比較相手 (7 日前) が存在しないため意味のあるチェックにならない (#64)。
  if (indicator.frequency === 'monthly' || indicator.frequency === 'quarterly') return false;
  if (indicator.unit === 'index' || indicator.unit === 'ratio') return true;
  if (indicator.unit === 'jpy-per-usd') return true;
  // percent のうち金利系は水準として扱う。valuation (成長率) は対象外。
  return indicator.unit === 'percent' && indicator.group === 'rates';
}

/** 値が有限数で、指標の想定範囲に収まっているか。 */
export function checkRange(
  indicatorId: string,
  indicator: Indicator,
  date: string,
  value: number,
): ValidationIssue[] {
  if (!Number.isFinite(value)) {
    return [
      {
        indicatorId,
        date,
        rule: 'finite',
        message: `有限数でない値 (${value})`,
      },
    ];
  }

  // 指標ごとの上書きが最優先 (#102)。単位だけでは自然な範囲が決まらない指標がある。
  const range = indicator.range ?? rangeFor(indicator.unit, indicator.group);
  if (range === null) return [];

  if (value < range.min || value > range.max) {
    return [
      {
        indicatorId,
        date,
        rule: 'range',
        message: `想定範囲 ${range.min}〜${range.max} を外れている (${value})`,
      },
    ];
  }
  return [];
}

/**
 * 前週比の急変チェック。既定は ±20%。
 * 桁の取り違えや別系列の混入は、たいてい急変として現れる。
 */
export function checkWeekOverWeek(
  indicatorId: string,
  indicator: Indicator,
  date: string,
  value: number,
  previous: number | null | undefined,
  thresholdPercent = 20,
): ValidationIssue[] {
  if (!isLevelIndicator(indicator)) return [];
  if (previous === null || previous === undefined || previous === 0) return [];

  const changePercent = Math.abs(((value - previous) / Math.abs(previous)) * 100);
  if (changePercent > thresholdPercent) {
    return [
      {
        indicatorId,
        date,
        rule: 'week-over-week',
        message: `前週比 ${changePercent.toFixed(1)}% の変化 (${previous} → ${value})。閾値 ${thresholdPercent}%`,
      },
    ];
  }
  return [];
}

/**
 * FactSet の終値と FRED の指数の整合。
 *
 * EPS は FactSet の終値を PER で割って導出するため、この 2 つが大きく乖離していると
 * 時点のずれか取得ミスを疑う。同日でも取得タイミングで多少ずれるので許容幅を持たせる。
 */
export function checkCloseConsistency(
  factsetClose: number | null | undefined,
  fredIndex: number | null | undefined,
  date: string,
  tolerancePercent = 1,
): ValidationIssue[] {
  if (factsetClose === null || factsetClose === undefined) return [];
  if (fredIndex === null || fredIndex === undefined) return [];
  if (fredIndex === 0) return [];

  const diffPercent = Math.abs(((factsetClose - fredIndex) / fredIndex) * 100);
  if (diffPercent > tolerancePercent) {
    return [
      {
        indicatorId: 'sp500-close-factset',
        date,
        rule: 'close-consistency',
        message: `FactSet の終値 ${factsetClose} と FRED の指数 ${fredIndex} が ${diffPercent.toFixed(2)}% 乖離している。閾値 ${tolerancePercent}%`,
      },
    ];
  }
  return [];
}

/**
 * 欠測が続きすぎていないか。
 *
 * FactSet の夏季休刊は実測で最大 2 週 (2026 年は 8/14・8/21)。
 * 3 週続くなら休刊ではなく URL 規則の変更や取得経路の破損を疑う。
 */
export function checkGapStreak(
  indicatorId: string,
  /** 新しい順に並んだ、その週にデータが取れたかどうか。 */
  recentWeeks: readonly boolean[],
  maxStreak = 2,
): ValidationIssue[] {
  let streak = 0;
  for (const hasData of recentWeeks) {
    if (hasData) break;
    streak += 1;
  }

  if (streak > maxStreak) {
    return [
      {
        indicatorId,
        rule: 'gap-streak',
        message: `${streak} 週連続で欠測している。休刊の実績は最大 ${maxStreak} 週のため取得経路の破損を疑う`,
      },
    ];
  }
  return [];
}

/** 抽出結果が空でないか (アダプタが何も返さなかった場合を検出する)。 */
export function checkNotEmpty(
  indicatorId: string,
  values: Readonly<Record<string, unknown>>,
): ValidationIssue[] {
  if (Object.keys(values).length === 0) {
    return [
      {
        indicatorId,
        rule: 'not-empty',
        message: '抽出結果が空。取得経路が壊れている可能性がある',
      },
    ];
  }
  return [];
}

/**
 * 検証結果をまとめてバッチの成否に落とす。
 * **1 件でも問題があれば失敗**。「緑だが歯抜け」を作らないため。
 */
export function assertNoIssues(issues: readonly ValidationIssue[]): void {
  if (issues.length === 0) return;

  const details = issues
    .map((issue) => {
      const at = issue.date !== undefined ? ` (${issue.date})` : '';
      return `  - [${issue.rule}] ${issue.indicatorId}${at}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(`検証に失敗した項目が ${issues.length} 件ある:\n${details}`);
}
