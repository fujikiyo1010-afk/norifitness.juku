import { SkeletonHeader, SkeletonCards } from "@/components/Skeleton";

// 月次添削の待ち画面
export default function MonthlyReviewLoading() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed]">
      <SkeletonHeader />
      <div className="mx-auto w-full max-w-[460px] flex-1 p-4 sm:p-6">
        <SkeletonCards count={3} />
      </div>
    </main>
  );
}
