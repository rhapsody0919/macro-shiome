import Link from 'next/link';

/** 存在しないパスへのフォールバック (screens S-4)。 */
export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        指定された URL のページは存在しません。
      </p>
      <p className="text-sm">
        <Link href="/" className="underline">
          バリュエーション画面へ
        </Link>
      </p>
    </div>
  );
}
