import Link from 'next/link';
import { changelog } from '@/lib/data/loader';

export const metadata = {
  title: '更新履歴 | macro-shiome',
};

export default function UpdatesPage() {
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-bold">更新履歴</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          指標や機能を追加・変更したときの記録です。新しい順に並んでいます。
        </p>
      </header>

      <ol className="space-y-4">
        {changelog.map((entry) => (
          <li
            key={`${entry.date}-${entry.title}`}
            className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{entry.date}</div>
            <div className="mt-1 text-sm">{entry.title}</div>
          </li>
        ))}
      </ol>

      <p className="text-sm">
        <Link href="/" className="underline">
          バリュエーション画面へ戻る
        </Link>
      </p>
    </article>
  );
}
