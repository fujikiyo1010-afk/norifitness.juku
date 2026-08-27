"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/lib/support/actions";
import { uploadSupportPhoto } from "@/lib/support/photo-upload";
import { SUPPORT_SCREENS } from "@/lib/support/types";
import { collectDeviceInfo } from "@/lib/support/device-info";

/**
 * 新しいお問い合わせを送る部品 (2026-08-27・玄関 /support の上部)
 *
 * 送信フォーム専用の画面は作らない ─ 初めての人に「ボタンだけの空っぽの画面」を
 * 見せないため、玄関にそのまま置く。送信するとその件のスレッドへ移動する。
 *
 * 端末・ブラウザ・アプリの版は本人に入力させず、送信時に自動で拾う
 * (古いアプリ版が端末に残っていると直したはずの不具合が再現するため。
 *  2026-07-29 の PWA キャッシュ反映不達インシデント参照)。
 */
export function SupportComposer() {
  const router = useRouter();
  const [screen, setScreen] = useState<string>("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (body.trim().length === 0) {
      setError("内容を入力してください");
      return;
    }
    setSending(true);
    setError(null);
    try {
      let photoPath: string | null = null;
      if (file) photoPath = await uploadSupportPhoto(file);

      const deviceInfo = await collectDeviceInfo();
      const result = await createTicket({
        screen: screen || null,
        body,
        photoPath,
        deviceInfo,
      });
      if (!result.ok) {
        setError(result.message);
        setSending(false);
        return;
      }
      router.push(`/support/${result.ticketId}`);
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
    <form onSubmit={handleSubmit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="例）食事の写真を送ろうとすると、ぐるぐる回ったまま進みません。"
        className="w-full resize-none rounded-lg border-[1.5px] border-[#ded5c4] bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-[#2b2620] placeholder:text-[#bdb5a6] focus:border-[#4a875b] focus:outline-none"
      />

      <select
        value={screen}
        onChange={(e) => setScreen(e.target.value)}
        aria-label="どの画面のことですか？"
        className="mt-2.5 w-full rounded-lg border-[1.5px] border-[#ded5c4] bg-white px-3 py-2.5 text-[12.5px] text-[#2b2620] focus:border-[#4a875b] focus:outline-none"
      >
        <option value="">どの画面のことですか？</option>
        {SUPPORT_SCREENS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

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
          type="submit"
          disabled={sending}
          className="btn3d rounded-lg px-6 py-3 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {sending ? "送信中…" : "送信する"}
        </button>
      </div>
    </form>
  );
}
