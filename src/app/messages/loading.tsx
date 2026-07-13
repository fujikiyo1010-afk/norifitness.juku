import { LoadingSpinner } from "@/components/LoadingSpinner";

// メッセージ (チャット) の待ち画面 = くるくるのみ・文字なし。発動条件は不変。
export default function MessagesLoading() {
  return (
    <main className="loading-gate flex flex-1 items-center justify-center bg-[#f9f5ed] text-[#4a875b] min-h-[60vh]">
      <LoadingSpinner size={40} />
    </main>
  );
}
