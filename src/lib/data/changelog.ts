import type { ChangelogEntry } from './types';

/** 新しい順に並べる。`data/changelog.json` の記載順に依存しない。 */
export function sortChangelog(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}
