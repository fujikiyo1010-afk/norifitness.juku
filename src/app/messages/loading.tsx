import { SkeletonHeader, SkeletonBox } from "@/components/Skeleton";

// メッセージ (チャット) の待ち画面 = 吹き出し風
export default function MessagesLoading() {
  return (
    <main className="loading-gate flex flex-1 flex-col bg-[#f9f5ed]">
      <SkeletonHeader />
      <div className="mx-auto w-full max-w-[460px] flex-1 space-y-4 p-4">
        <SkeletonBox className="h-12 w-3/4 rounded-2xl" />
        <SkeletonBox className="ml-auto h-12 w-2/3 rounded-2xl" />
        <SkeletonBox className="h-16 w-4/5 rounded-2xl" />
        <SkeletonBox className="ml-auto h-10 w-1/2 rounded-2xl" />
        <SkeletonBox className="h-12 w-3/5 rounded-2xl" />
      </div>
    </main>
  );
}
