"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendAnnouncement } from "@/lib/announcements/actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * アナウンス 送信ボタン (Client Component ・ 2026-06-18 C-1)
 *
 * - 「送信」 押下 → confirm → sendAnnouncement → 成功で一覧へ遷移
 * - 二段階確認 (= window.confirm でダブルチェック)
 */
export function SendButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    if (!window.confirm("本当に送信しますか? (送信後は取り消せません)")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await sendAnnouncement(id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      alert(`${r.recipient_count} 件に送信しました`);
      router.push("/admin/announcements");
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="rounded-[4px] bg-amber-700 hover:bg-amber-800 text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {isPending ? (
          <>
            <LoadingSpinner /> 送信中…
          </>
        ) : (
          "送信する"
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700">⚠ {error}</p>
      )}
    </div>
  );
}
