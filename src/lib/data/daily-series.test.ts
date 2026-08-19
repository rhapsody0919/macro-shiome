import { describe, expect, it } from 'vitest';
import { DAILY_SERIES } from './daily-series';

describe('日次ビューの系列 (#168)', () => {
  it('同じ系列を 2 つのページに載せない', () => {
    // 重複させると、片方だけ直して食い違う事故が起きる。
    // ビューはページごとに丸ごとインライン展開されるため、重複はサイズの無駄でもある。
    const all = Object.values(DAILY_SERIES).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('どのページも 1 つ以上の系列を持つ', () => {
    // 空のビューを書き出しても意味がない。
    for (const [name, keys] of Object.entries(DAILY_SERIES)) {
      expect(keys.length, name).toBeGreaterThan(0);
    }
  });
});
