import { SkeletonBox } from "@/components/Skeleton";

// 管理画面の待ち画面 (= デスクトップ前提・ニュートラルな配色)
export default function AdminLoading() {
  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <SkeletonBox className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBox key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBox key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
