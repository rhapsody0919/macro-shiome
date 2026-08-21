'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

/** localStorage のキー。値は最後に既読にした更新履歴の日付 (YYYY-MM-DD)。 */
const LAST_SEEN_KEY = 'macro-shiome:changelog:lastSeen';

/**
 * localStorage への書き込みは同じタブの購読者に自動通知されない (`storage` イベントは他タブのみ)。
 * `useSyncExternalStore` で読むため、書き込み側で明示的に通知する。
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(LAST_SEEN_KEY);
}

/** SSR (静的ビルド) 時点では localStorage が無いので既読情報も無い扱いにする。 */
function getServerSnapshot(): string | null {
  return null;
}

function markAsRead(date: string): void {
  window.localStorage.setItem(LAST_SEEN_KEY, date);
  for (const listener of listeners) listener();
}

/**
 * `/updates` を表示中かどうか。
 *
 * 静的エクスポート (`trailingSlash: true`) の本番ビルドでは `usePathname()` が
 * 末尾スラッシュ付き (`/updates/`) を返す。開発サーバーでは付かない。両方を許容する。
 */
function isUpdatesPage(pathname: string): boolean {
  return pathname === '/updates' || pathname === '/updates/';
}

/**
 * ヘッダーの更新履歴リンク + 未読バッジ (#243)。
 *
 * フッターのリンク (#240) は画面最下部でスクロールしないと気付けない。
 * ヘッダー常時表示の位置に置き、最新の更新履歴より既読日が古ければ未読として示す。
 *
 * 既読判定は `/updates` を開いた時点で行う。ヘッダーはレイアウト内で常駐し
 * ページ遷移では再マウントしないため、`usePathname` の変化で検知する。
 */
export function UpdatesLink({ latestDate }: { latestDate: string | undefined }) {
  const pathname = usePathname();
  const lastSeen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (latestDate !== undefined && isUpdatesPage(pathname)) {
      markAsRead(latestDate);
    }
  }, [latestDate, pathname]);

  // 更新履歴が 1 件も無い状態は無い (`changelog.test.ts` で固定済み) が、
  // 型上は undefined になりうるため防御する。未訪問 (lastSeen === null) は未読として扱う。
  const hasUnread =
    latestDate !== undefined && !isUpdatesPage(pathname) && (lastSeen === null || lastSeen < latestDate);

  return (
    <Link
      href="/updates"
      className="relative inline-flex items-center whitespace-nowrap px-2 py-1.5 text-sm text-slate-600 hover:text-slate-900 sm:px-3 dark:text-slate-400 dark:hover:text-slate-100"
    >
      更新履歴
      {hasUnread && (
        <span
          aria-label="未読の更新があります"
          className="ml-1.5 h-2 w-2 rounded-full bg-red-500"
        />
      )}
    </Link>
  );
}
