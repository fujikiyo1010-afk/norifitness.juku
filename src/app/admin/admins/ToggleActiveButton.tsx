"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAdminActive } from "./actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export function ToggleActiveButton({
  adminId,
  isActive,
  isSelf,
}: {
  adminId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (isSelf) return;
    if (
      !window.confirm(
        isActive
          ? "この管理者を 無効化 しますか? (= ログインできなくなります)"
          : "この管理者を 有効化 しますか?"
      )
    )
      return;
    startTransition(async () => {
      const result = await toggleAdminActive({ adminId, nextActive: !isActive });
      if (!result.ok) {
        alert(`失敗: ${result.error}`);
        return;
      }
      router.refresh();
    });
  }

  if (isSelf) {
    return (
      <span className="text-[10px] text-zinc-400">自分</span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`text-[11px] font-bold px-3 py-1 rounded border transition-colors ${
        isActive
          ? "bg-white text-red-700 border-red-200 hover:bg-red-50"
          : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
      } disabled:opacity-50`}
    >
      {pending ? (
        <>
          <LoadingSpinner /> 処理中…
        </>
      ) : isActive ? (
        "無効化"
      ) : (
        "有効化"
      )}
    </button>
  );
}
