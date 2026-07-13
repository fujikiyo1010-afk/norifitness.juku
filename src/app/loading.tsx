import { LoadingSpinner } from "@/components/LoadingSpinner";

// 全受講生ページ共通の待ち画面 = くるくる(円形スピナー)のみ・文字なし。
// 発動条件は不変: loading.tsx の存在・loading-gate で最初250msは透明→速いページでは出ない。
export default function Loading() {
  return (
    <div className="loading-gate flex min-h-[60vh] items-center justify-center text-[#4a875b]">
      <LoadingSpinner size={40} />
    </div>
  );
}
