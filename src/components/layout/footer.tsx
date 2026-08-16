/**
 * グローバルフッター (screens N-2)。
 *
 * FRED の利用規約が必須としている文言をここに置く。
 * 各指標の出所一覧・利用規約ページ・免責の詳細は #21 (F-11) で追加する。
 */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 px-6 py-8 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div className="mx-auto max-w-6xl space-y-2">
        {/* FRED API 利用規約が「目立つ形での表示」を義務づけている文言。文面は変更しない。 */}
        <p>
          This product uses the FRED® API but is not endorsed or certified by the Federal Reserve
          Bank of St. Louis.
        </p>
        <p>
          本サイトは指標の提示のみを行い、投資助言ではありません。表示される数値は導出値を含みます。
        </p>
      </div>
    </footer>
  );
}
