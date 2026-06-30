import { MemberPageSkeleton } from "@/components/Skeleton";

// 全受講生ページ共通の待ち画面 (= より近い loading.tsx があればそちらが優先)
export default function Loading() {
  return <MemberPageSkeleton cards={3} />;
}
