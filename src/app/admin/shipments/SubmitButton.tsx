"use client";

import { useFormStatus } from "react-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * 発送管理 ・ form 内サブミットボタン (= useFormStatus で pending 検知)
 *
 * 用途:
 *   - 「発送済にする」 ボタン
 *   - 「取消」 リンク
 *
 * server action 実行中は disabled + スピナー表示 = 連打防止。
 */
export function ShipmentMarkButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00897b] hover:bg-[#00695c] text-white rounded-md text-xs font-bold disabled:opacity-60"
    >
      {pending ? (
        <>
          <LoadingSpinner /> 処理中…
        </>
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          発送済にする
        </>
      )}
    </button>
  );
}

export function ShipmentUndoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-[11px] text-zinc-600 hover:text-zinc-900 underline disabled:opacity-60"
    >
      {pending ? "処理中…" : "取消"}
    </button>
  );
}
