import { describe, expect, it } from 'vitest';
import { sortChangelog } from './changelog';
import { changelog } from './loader';
import type { ChangelogEntry } from './types';

describe('sortChangelog', () => {
  it('日付の新しい順に並べる', () => {
    const entries: ChangelogEntry[] = [
      { date: '2026-01-10', title: 'a' },
      { date: '2026-03-01', title: 'b' },
      { date: '2026-02-15', title: 'c' },
    ];

    expect(sortChangelog(entries).map((e) => e.date)).toEqual([
      '2026-03-01',
      '2026-02-15',
      '2026-01-10',
    ]);
  });

  it('元の配列を書き換えない', () => {
    const entries: ChangelogEntry[] = [
      { date: '2026-01-10', title: 'a' },
      { date: '2026-03-01', title: 'b' },
    ];
    const original = [...entries];

    sortChangelog(entries);

    expect(entries).toEqual(original);
  });
});

/**
 * 読者向け解説 (#208, `explanation.test.ts`) と同じ約束を更新履歴にも課す。
 * `note` と違い、こちらは常に画面に出るため書き手が忘れても落ちるようにする。
 */
describe('更新履歴の読者向け文言', () => {
  it('1 件以上ある', () => {
    expect(changelog.length).toBeGreaterThan(0);
  });

  it.each(changelog)('$title: 日付が YYYY-MM-DD 形式', (entry) => {
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(changelog)('$title: Issue 番号やコード識別子を含まない', (entry) => {
    expect(entry.title).not.toMatch(/#\d+|`/);
  });

  it.each(changelog)('$title: マークダウンの装飾を含まない', (entry) => {
    expect(entry.title).not.toMatch(/\*\*|__/);
  });

  it.each(changelog)('$title: 評価語を含まない', (entry) => {
    expect(entry.title).not.toMatch(/危険|悪化のサイン|買い時|売り時|望ましい水準/);
  });
});

describe('更新履歴の検査が実際に落ちること', () => {
  it('Issue 番号の混入を検知する', () => {
    expect('#240 で追加').toMatch(/#\d+|`/);
  });

  it('マークダウンの装飾を検知する', () => {
    expect('**新機能**').toMatch(/\*\*|__/);
  });

  it('評価語を検知する', () => {
    expect('いま買い時です').toMatch(/危険|悪化のサイン|買い時|売り時|望ましい水準/);
  });
});
