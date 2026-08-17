import { describe, expect, it } from 'vitest';
import {
  ECONOMY_QUESTIONS,
  MARKET_QUESTIONS,
  groupByQuestion,
  type Question,
} from './questions';
import { CYCLE_META } from './cycle';
import type { CyclePosition } from './data/types';

interface Item {
  name: string;
  question: 'a' | 'b' | 'c';
}

const QUESTIONS: Record<'a' | 'b' | 'c', Question> = {
  a: { title: '問い A', guide: '説明 A' },
  b: { title: '問い B', guide: '説明 B' },
  c: { title: '問い C', guide: '説明 C' },
};

const questionOf = (item: Item) => item.question;

describe('問いによるセクション分け', () => {
  it('定義順に並べる (項目の出現順ではない)', () => {
    // 上流 → 下流の順に定義しているため、順序そのものが読み方になっている。
    const items: Item[] = [
      { name: '3', question: 'c' },
      { name: '1', question: 'a' },
      { name: '2', question: 'b' },
    ];
    expect(groupByQuestion(items, QUESTIONS, questionOf).map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('空の問いは返さない', () => {
    // 指標が無い問いの見出しだけ並ぶと壊れて見える。
    const groups = groupByQuestion([{ name: '1', question: 'b' }], QUESTIONS, questionOf);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('b');
  });

  it('問いの中では元の順序を保つ', () => {
    const items: Item[] = [
      { name: 'first', question: 'a' },
      { name: 'second', question: 'a' },
    ];
    expect(groupByQuestion(items, QUESTIONS, questionOf)[0].items.map((i) => i.name)).toEqual([
      'first',
      'second',
    ]);
  });

  it('項目が無ければ空を返す', () => {
    expect(groupByQuestion([], QUESTIONS, questionOf)).toEqual([]);
  });

  it('すべての問いに読み方の指針がある', () => {
    // 問いだけでは何を読み取るかまで伝わらない。指針が無いと分けた意味が無い。
    for (const question of [
      ...Object.values(ECONOMY_QUESTIONS),
      ...Object.values(MARKET_QUESTIONS),
    ]) {
      expect(question.title.length).toBeGreaterThan(0);
      expect(question.guide.length).toBeGreaterThan(0);
    }
  });
});

describe('景気サイクルのバッジ', () => {
  it('全分類に表示名と説明がある', () => {
    // セクション見出しから外した分、バッジ側で意味が分かる必要がある (#89)。
    const positions: CyclePosition[] = ['leading', 'coincident', 'lagging'];
    for (const position of positions) {
      expect(CYCLE_META[position].label.length).toBeGreaterThan(0);
      expect(CYCLE_META[position].description.length).toBeGreaterThan(0);
    }
  });
});
