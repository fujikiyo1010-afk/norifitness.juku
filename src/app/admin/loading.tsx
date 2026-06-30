import { LoadingSpinner } from "@/components/LoadingSpinner";

// 管理画面の待ち画面 = くるくる(円形スピナー)のみ。
// loading-gate で最初の250msは透明 → 速いページでは出ない。
export default function AdminLoading() {
  return (
    <div className="loading-gate flex min-h-[60vh] items-center justify-center text-[#4a875b]">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <span className="text-sm text-zinc-500">読み込み中…</span>
      </div>
    </div>
  );
}
