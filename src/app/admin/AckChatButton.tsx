"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ackChatUnreplied } from "@/lib/admin/chat-ack";

/**
 * 管理ホーム「チャット未返信」の手動「完了にする」ボタン(案A・ワンクリック)。
 * 返信せず返信不要として片付ける。押すと警報が抑制され、カードから外れる
 * (他タグが残る人はカードは残る)。受講生が新しく発言すれば自動で再表示。
 */
export function AckChatButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () =>
    startTransition(async () => {
      setError(null);
      const r = await ackChatUnreplied({ userId });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="このチャットを返信不要として完了にする"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#e8ebe9] rounded-md text-xs font-semibold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/10 transition-colors disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {pending ? "完了中…" : error ? "再試行" : "完了にする"}
    </button>
  );
}
