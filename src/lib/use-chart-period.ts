'use client';

import { useState } from 'react';
import type { Period } from './period';

/**
 * チャート単位で期間フィルターを上書きする (#299)。
 *
 * **URL には載せない。** 約80枚ぶんのクエリを持たせると URL が肥大化するため、
 * 上書きはローカル state に留める。ページ遷移・リロードでグローバルの値に戻る。
 * 一度上書きすると、以降はグローバル側が変わってもそのチャートには影響しない
 * (`override` が非 null である限り優先する)。
 */
export function useChartPeriod(globalPeriod: Period): [Period, (period: Period) => void] {
  const [override, setOverride] = useState<Period | null>(null);
  return [override ?? globalPeriod, setOverride];
}
