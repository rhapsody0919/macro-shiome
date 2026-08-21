/**
 * 現在地判定 (末尾スラッシュを無視して比較する) (#245)。
 *
 * 静的エクスポート (`trailingSlash: true`, ADR-0002) の本番ビルドでは `usePathname()` が
 * 末尾スラッシュ付き (`/economy/`) を返すが、開発サーバーでは付かない (`/economy`)。
 * 素朴な文字列一致だと本番ビルドでのみ現在地判定が外れる。
 */
export function isCurrentPath(pathname: string, target: string): boolean {
  return normalizePath(pathname) === normalizePath(target);
}

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
