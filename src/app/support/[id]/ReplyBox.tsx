"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMessage } from "@/lib/support/actions";
import { uploadSupportPhoto } from "@/lib/support/photo-upload";

/**
 * スレッドの返信欄 (2026-08-27 新設)
 * 対応中のときだけ表示する (解決済みは page.tsx 側で出さない)。
 */
export function ReplyBox({
  ticketId,
  userId,
}: {
  ticketId: string;
  userId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (sending) return;
    if (body.trim().length === 0 && !file) return;
    setSending(true);
    setError(null);
    try {
      let photoPath: string | null = null;
      if (file) photoPath = await uploadSupportPhoto(userId, file);
      const result = await addMessage(
        ticketId,
        body.trim().length > 0 ? body : "（写真を送りました）",
        photoPath
      );
      if (!result.ok) {
        setError(result.message);
        setSending(false);
        return;
      }
      setBody("");
      setFile(null);
      setSending(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "送信に失敗しました。もう一度お試しください。"
      );
      setSending(false);
    }
  }

  return (
    <div className="sticky bottom-0 bg-[#fffdf8] border-t border-[#e7dcc9] px-3 py-2.5">
      {error && (
        <p className="text-[11.5px] text-[#b3475b] leading-relaxed mb-2 px-1">
          {error}
        </p>
      )}
      {file && (
        <p className="text-[11px] text-[#6b6b6b] mb-2 px-1 truncate">
          添付: {file.name}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label className="w-[34px] h-[34px] rounded-full border-[1.5px] border-[#ded5c4] bg-white text-[#8aa894] flex items-center justify-center shrink-0 cursor-pointer">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            className="w-[17px] h-[17px]"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="続けて聞きたいことがあれば…"
          className="flex-1 border-[1.5px] border-[#ded5c4] bg-white rounded-full px-4 py-2 text-[12px] text-[#2b2620] placeholder:text-[#bdb5a6]"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (body.trim().length === 0 && !file)}
          aria-label="送信"
          className="w-[34px] h-[34px] rounded-full bg-[#4a875b] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[15px] h-[15px]"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
