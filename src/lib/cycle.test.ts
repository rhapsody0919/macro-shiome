import { describe, expect, it } from 'vitest';
import { CYCLE_ORDER, groupByCycle } from './cycle';
import type { CyclePosition } from './data/types';

interface Item {
  name: string;
  position?: CyclePosition;
}

const positionOf = (item: Item) => item.position;

describe('景気サイクルによるセクション分け', () => {
  it('先行 → 一致 → 遅行 → その他 の順に並べる', () => {
    // 表示順そのものが意味を持つ (先行を先に見せる)。
    const items: Item[] = [
      { name: 'd' },
      { name: 'c', position: 'lagging' },
      { name: 'a', position: 'leading' },
      { name: 'b', position: 'coincident' },
    ];
    expect(groupByCycle(items, positionOf).map((g) => g.section)).toEqual([
      'leading',
      'coincident',
      'lagging',
      'unclassified',
    ]);
  });

  it('空のセクションは返さない', () => {
    // 指標が少ない段階で空の見出しだけ並ぶと壊れて見える。
    const groups = groupByCycle([{ name: 'a', position: 'leading' }], positionOf);
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('leading');
  });

  it('分類を持たない指標は「その他」に入る', () => {
    // 省略は「未分類」ではなく「分類に当てはまらない」を意味する。
    const groups = groupByCycle([{ name: 'usdjpy' }], positionOf);
    expect(groups[0].section).toBe('unclassified');
  });

  it('セクション内では元の順序を保つ', () => {
    const items: Item[] = [
      { name: 'first', position: 'leading' },
      { name: 'second', position: 'leading' },
    ];
    expect(groupByCycle(items, positionOf)[0].items.map((i) => i.name)).toEqual([
      'first',
      'second',
    ]);
  });

  it('項目が無ければ空を返す', () => {
    expect(groupByCycle([], positionOf)).toEqual([]);
  });

  it('全セクションに説明文がある', () => {
    // 順序の意味が伝わらないと分けた意味が無い。
    const groups = groupByCycle(
      CYCLE_ORDER.map((section) => ({
        name: section,
        position: section === 'unclassified' ? undefined : (section as CyclePosition),
      })),
      positionOf,
    );
    expect(groups).toHaveLength(CYCLE_ORDER.length);
    for (const group of groups) {
      expect(group.meta.label.length).toBeGreaterThan(0);
      expect(group.meta.description.length).toBeGreaterThan(0);
    }
  });
});
