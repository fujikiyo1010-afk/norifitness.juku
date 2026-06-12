import Link from "next/link";
import { listMyReviewsWithContext } from "@/lib/courses/queries";
import { ReviewsListView } from "./ReviewsListView";

export const dynamic = "force-dynamic";

export default async function MyReviewsPage() {
  const reviews = await listMyReviewsWithContext();

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e8ebe9] bg-white p-6 space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500 space-x-1">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span>/</span>
            <Link href="/my-log" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              学習
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">振り返り</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <PenIcon />
            振り返り
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

function PenIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
