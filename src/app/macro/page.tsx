export default function MacroPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">マクロ指標</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        相場環境の周辺指標を見る画面。将来の指標追加はここが受け皿になる。
      </p>
      <p className="text-sm text-slate-500">
        VIX / USD-JPY / 10年債利回りのチャートは Issue #20 で実装する。
      </p>
    </div>
  );
}
