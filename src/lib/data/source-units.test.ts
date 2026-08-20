import { describe, expect, it } from 'vitest';
import { indicators } from './indicators';

/**
 * 提供元の単位と読者向けの表記で**桁が食い違っていないか** (#212)。
 *
 * `pnpm verify --units` は FRED に取りに行くため毎回は回さない (系列ページは 1 件 79 KB で、
 * 実測で連続アクセスが弾かれた)。**桁の突き合わせ自体はネットワーク不要**なので、
 * 記録済みの `sourceUnits` に対してここで毎回見る。
 *
 * 実際に誤ったのは 2 回とも桁だった。
 * - #198: BUSLOANS を百万ドルと書いたが十億ドル
 * - #212: 自発的離職・採用を「人」と書いたが千人 (実データも 3,232 で千人単位)
 */
const SCALE_RULES: ReadonlyArray<{ source: string; label: RegExp }> = [
  { source: 'Billions of', label: /10億ドル|十億ドル/ },
  { source: 'Millions of Dollars', label: /百万ドル/ },
  { source: 'Millions of U.S. Dollars', label: /百万ドル/ },
  { source: 'Millions of Units', label: /百万台/ },
  { source: 'Level in Thousands', label: /千/ },
  { source: 'Thousands', label: /千/ },
];

const scaled = Object.entries(indicators)
  .map(([id, indicator]) => {
    const { sourceUnits, unitLabel } = indicator;
    if (sourceUnits === undefined || unitLabel === undefined) return null;
    const rule = SCALE_RULES.find((entry) => sourceUnits.startsWith(entry.source));
    return rule === null || rule === undefined ? null : { id, sourceUnits, unitLabel, rule };
  })
  .filter((entry) => entry !== null);

describe('提供元の単位と表示の桁', () => {
  it('照合対象が存在する', () => {
    // 0 件を成功にすると「検査しているつもり」で通ってしまう (#102)。
    expect(scaled.length).toBeGreaterThan(10);
  });

  it.each(scaled.map((entry) => [entry.id, entry] as const))(
    '%s: 桁が一致する',
    (_id, entry) => {
      expect(entry.unitLabel).toMatch(entry.rule.label);
    },
  );

  it('桁の食い違いを検知する', () => {
    // 障害注入。#212 で実際にあった誤りをそのまま使う。
    expect('人・季節調整済み').not.toMatch(/千/);
  });
});
