import Link from "next/link";
import { listMyReviewsWithContext } from "@/lib/courses/queries";
import { ReviewsListView } from "./ReviewsListView";

export const dynamic = "force-dynamic";

export default async function MyReviewsPage() {
  const reviews = await listMyReviewsWithContext();

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500 space-x-1">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span>/</span>
            <Link href="/my-log" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              マイ学習ログ
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">振り返り</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            📝 振り返り
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            あなたが書いた振り返りの一覧です。並び替え・検索もできます。
          </p>
        </header>

        <ReviewsListView reviews={reviews} />
      </div>
    </main>
  );
}
