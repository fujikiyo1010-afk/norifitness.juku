import { SkeletonHeader, SkeletonCards } from "@/components/Skeleton";

// コース一覧 / コース詳細 / レッスンの待ち画面 (= 進捗バー付きカード)
export default function CoursesLoading() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed]">
      <SkeletonHeader />
      <div className="mx-auto w-full max-w-[460px] flex-1 p-4 sm:p-6">
        <SkeletonCards count={4} />
      </div>
    </main>
  );
}
