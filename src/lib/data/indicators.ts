/**
 * 指標マスタと設定の読み込み・検証。
 *
 * JSON は型注釈だけでは信用しない。壊れた指標マスタで静かに動き続けるより、
 * 起動時に落として原因を明示する方が安全なため、実行時に検証する。
 */
import rawIndicators from '../../../data/indicators.json';
import rawConfig from '../../../data/config.json';
import type {
  AppConfig,
  CopyrightClass,
  FactsetField,
  Frequency,
  Indicator,
  CyclePosition,
  IndicatorGroup,
  IndicatorMaster,
  IndicatorSource,
  IndexKey,
  TargetYieldEntry,
  Unit,
} from './types';

const FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
] as const satisfies readonly Frequency[];
const UNITS = [
  'index',
  'diffusion',
  'percent',
  'ratio',
  'jpy-per-usd',
] as const satisfies readonly Unit[];
const COPYRIGHTS = ['none', 'restricted'] as const satisfies readonly CopyrightClass[];
const GROUPS = [
  'equity',
  'valuation',
  'rates',
  'fx',
  'volatility',
  'macro',
] as const satisfies readonly IndicatorGroup[];
const FACTSET_FIELDS = [
  'forwardPe',
  'trailingPe',
  'forwardPe5yAvg',
  'forwardPe10yAvg',
  'trailingPe5yAvg',
  'trailingPe10yAvg',
  'closePrice',
  'blendedGrowthToday',
  'blendedGrowthLastWeek',
  'blendedGrowthQuarterEnd',
  'growthNextQuarter',
  'growthQuarterAfterNext',
  'growthCurrentCalendarYear',
  'growthNextCalendarYear',
] as const satisfies readonly FactsetField[];
const HISTORY_LIMITS = ['10y', '5y'] as const;
const CYCLE_POSITIONS = [
  'leading',
  'coincident',
  'lagging',
] as const satisfies readonly CyclePosition[];
const INDEX_KEYS = ['sp500', 'nasdaq100'] as const satisfies readonly IndexKey[];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${where}: 空でない文字列が必要 (実際: ${JSON.stringify(value)})`);
  }
  return value;
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  where: string,
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `${where}: ${allowed.join(' | ')} のいずれかが必要 (実際: ${JSON.stringify(value)})`,
    );
  }
  return value as T;
}

function parseSource(raw: unknown, where: string): IndicatorSource {
  if (!isRecord(raw)) {
    throw new Error(`${where}: source がオブジェクトでない`);
  }
  const adapter = requireEnum(
    raw.adapter,
    ['fred', 'factset-pdf', 'stockanalysis', 'treasury'] as const,
    `${where}.adapter`,
  );

  switch (adapter) {
    case 'fred':
      return { adapter, seriesId: requireString(raw.seriesId, `${where}.seriesId`) };
    case 'factset-pdf':
      return { adapter, field: requireEnum(raw.field, FACTSET_FIELDS, `${where}.field`) };
    case 'stockanalysis':
      return {
        adapter,
        symbol: requireString(raw.symbol, `${where}.symbol`),
        field: requireEnum(raw.field, ['peRatio'] as const, `${where}.field`),
      };
    case 'treasury':
      return {
        adapter,
        auction: requireEnum(raw.auction, ['ten-year-bid-to-cover'] as const, `${where}.auction`),
      };
  }
}

export function parseIndicator(id: string, raw: unknown): Indicator {
  const where = `indicators.${id}`;
  if (!isRecord(raw)) {
    throw new Error(`${where}: オブジェクトでない`);
  }

  const indicator: Indicator = {
    name: requireString(raw.name, `${where}.name`),
    source: parseSource(raw.source, where),
    frequency: requireEnum(raw.frequency, FREQUENCIES, `${where}.frequency`),
    unit: requireEnum(raw.unit, UNITS, `${where}.unit`),
    attribution: requireString(raw.attribution, `${where}.attribution`),
    copyright: requireEnum(raw.copyright, COPYRIGHTS, `${where}.copyright`),
    group: requireEnum(raw.group, GROUPS, `${where}.group`),
  };

  if (raw.historyLimit !== undefined) {
    indicator.historyLimit = requireEnum(
      raw.historyLimit,
      HISTORY_LIMITS,
      `${where}.historyLimit`,
    );
  }
  if (raw.cyclePosition !== undefined) {
    indicator.cyclePosition = requireEnum(
      raw.cyclePosition,
      CYCLE_POSITIONS,
      `${where}.cyclePosition`,
    );
  }
  if (raw.optionalInReport !== undefined) {
    if (typeof raw.optionalInReport !== 'boolean') {
      throw new Error(`${where}.optionalInReport: 真偽値でない (${typeof raw.optionalInReport})`);
    }
    indicator.optionalInReport = raw.optionalInReport;
  }
  if (raw.note !== undefined) {
    indicator.note = requireString(raw.note, `${where}.note`);
  }

  return indicator;
}

export function parseIndicatorMaster(raw: unknown): IndicatorMaster {
  if (!isRecord(raw)) {
    throw new Error('indicators.json: オブジェクトでない');
  }

  const master: IndicatorMaster = {};
  for (const [id, value] of Object.entries(raw)) {
    master[id] = parseIndicator(id, value);
  }

  // 同じ FRED series を二重に登録すると、同じ値が別 ID で蓄積されて取り違えの元になる。
  const seenSeriesIds = new Map<string, string>();
  for (const [id, indicator] of Object.entries(master)) {
    if (indicator.source.adapter !== 'fred') continue;
    const existing = seenSeriesIds.get(indicator.source.seriesId);
    if (existing !== undefined) {
      throw new Error(
        `indicators.json: FRED series "${indicator.source.seriesId}" が ${existing} と ${id} で重複している`,
      );
    }
    seenSeriesIds.set(indicator.source.seriesId, id);
  }

  return master;
}

function parseTargetYieldEntries(raw: unknown, where: string): TargetYieldEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${where}: 1 件以上の配列が必要`);
  }

  const entries = raw.map((item, i): TargetYieldEntry => {
    const at = `${where}[${i}]`;
    if (!isRecord(item)) {
      throw new Error(`${at}: オブジェクトでない`);
    }
    if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value <= 0) {
      throw new Error(`${at}.value: 正の数値が必要 (実際: ${JSON.stringify(item.value)})`);
    }
    const from = requireString(item.from, `${at}.from`);
    if (!DATE_PATTERN.test(from)) {
      throw new Error(`${at}.from: YYYY-MM-DD 形式が必要 (実際: ${from})`);
    }
    // 理由は必須。前提が変われば見直す値であり、記録が無いと後から判断できないため。
    const entry: TargetYieldEntry = {
      value: item.value,
      from,
      reason: requireString(item.reason, `${at}.reason`),
    };
    // 設定時の実質金利は任意。古い設定には無いため、欠けていても失敗させない。
    if (item.realRateAtSetting !== undefined) {
      if (typeof item.realRateAtSetting !== 'number' || !Number.isFinite(item.realRateAtSetting)) {
        throw new Error(`${at}.realRateAtSetting: 数値が必要`);
      }
      entry.realRateAtSetting = item.realRateAtSetting;
    }
    return entry;
  });

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].from <= entries[i - 1].from) {
      throw new Error(`${where}: from が昇順になっていない (${entries[i - 1].from} → ${entries[i].from})`);
    }
  }

  return entries;
}

export function parseAppConfig(raw: unknown): AppConfig {
  if (!isRecord(raw) || !isRecord(raw.targetYield)) {
    throw new Error('config.json: targetYield が無い');
  }

  const targetYield = {} as AppConfig['targetYield'];
  for (const key of INDEX_KEYS) {
    targetYield[key] = parseTargetYieldEntries(
      raw.targetYield[key],
      `config.targetYield.${key}`,
    );
  }

  return { targetYield };
}

/**
 * 指定日時点で有効な基準益回りを返す。
 * 履歴は from の昇順なので、date 以下で最も新しいものを採る。
 */
export function resolveTargetYield(config: AppConfig, index: IndexKey, date: string): number {
  return resolveTargetYieldEntry(config, index, date).value;
}

/** 指定日時点で有効な設定エントリ本体を返す (設定時の実質金利を参照するため)。 */
export function resolveTargetYieldEntry(
  config: AppConfig,
  index: IndexKey,
  date: string,
): TargetYieldEntry {
  const entries = config.targetYield[index];
  let current = entries[0];
  for (const entry of entries) {
    if (entry.from <= date) current = entry;
  }
  return current;
}

export const indicators: IndicatorMaster = parseIndicatorMaster(rawIndicators);
export const appConfig: AppConfig = parseAppConfig(rawConfig);
