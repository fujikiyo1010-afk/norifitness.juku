import { listMyReviewsWithContext } from "@/lib/courses/queries";
import { ReviewsListView } from "./ReviewsListView";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

export default async function MyReviewsPage() {
  const reviews = await listMyReviewsWithContext();

  return (
    <>
      <MemberHeader title="振り返り" fallbackHref="/my-log" />
      <main className="flex flex-1 flex-col bg-[#ebdfc6] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8] p-6 space-y-6">
        <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
          あなたが書いた振り返りの一覧です。並び替え・検索もできます。
        </p>

        <ReviewsListView reviews={reviews} />
        </div>
      </main>
    </>
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
