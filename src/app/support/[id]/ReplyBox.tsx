"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMessage } from "@/lib/support/actions";
import { uploadSupportPhoto } from "@/lib/support/photo-upload";

/**
 * スレッドの返信欄 (2026-08-27・D型)
 *
 * チャットのような下貼り付きのピル入力にはしない ─ ここはチャットとは別の窓口で、
 * 「1件ずつ、書いて送信するを押して送る」場だと見た目でも分けるため。
 * 玄関(SupportComposer)とまったく同じ形にそろえている。
 * 対応中のときだけ表示する(解決済みは page.tsx 側で出さない)。
 */
export function ReplyBox({ ticketId }: { ticketId: string }) {
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
      if (file) photoPath = await uploadSupportPhoto(file);
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
        err instanceof Error
          ? err.message
          : "送信に失敗しました。もう一度お試しください。"
      );
      setSending(false);
    }
  }

  return (
    // 下ナビ(fixed・60px+セーフエリア)のすぐ上に固定する(きよむ指摘 2026-08-27)。
    // 会話が長くてもスクロールせずに書ける。短い時も sticky が下ナビの上まで持ち上げる。
    <div
      className="sticky z-20 bg-[#f9f5ed] border-t border-[#e7dcc9] px-4 pt-3 pb-3"
      style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="続けてお伝えすることがあれば…"
        className="w-full resize-none rounded-lg border-[1.5px] border-[#ded5c4] bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-[#2b2620] placeholder:text-[#bdb5a6] focus:border-[#4a875b] focus:outline-none"
      />

      {file && (
        <p className="mt-2 truncate px-1 text-[11px] text-[#6b6b6b]">
          添付: {file.name}
        </p>
      )}
      {error && (
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-[#b3475b]">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-2.5">
        <label
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-[#ded5c4] bg-white text-[#8aa894]"
          aria-label="写真を選ぶ"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-[17px] w-[17px]"
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

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (body.trim().length === 0 && !file)}
          className="btn3d rounded-lg px-6 py-3 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {sending ? "送信中…" : "送信する"}
        </button>
      </div>
    </div>
  );
}
