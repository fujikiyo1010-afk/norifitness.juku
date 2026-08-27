"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/lib/support/actions";
import { uploadSupportPhoto } from "@/lib/support/photo-upload";
import { SUPPORT_KINDS, SUPPORT_SCREENS } from "@/lib/support/types";
import { collectDeviceInfo } from "@/lib/support/device-info";

/**
 * お問い合わせ フォーム本体 (2026-08-27 新設)
 *
 * 端末・ブラウザ・アプリの版は本人に入力させず、送信時に自動で拾う
 * (古いアプリ版が端末に残っていると直したはずの不具合が再現するため。
 *  2026-07-29 の PWA キャッシュ反映不達インシデント参照)。
 */
export function SupportForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<string>(SUPPORT_KINDS[0]);
  const [screen, setScreen] = useState<string>(SUPPORT_SCREENS[0]);
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
      if (file) photoPath = await uploadSupportPhoto(userId, file);

      const deviceInfo = await collectDeviceInfo();
      const result = await createTicket({
        kind,
        screen,
        body,
        photoPath,
        deviceInfo,
      });
      if (!result.ok) {
        setError(result.message);
        setSending(false);
        return;
      }
      router.replace(`/support/${result.ticketId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "送信に失敗しました。もう一度お試しください。"
      );
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-4 pb-10">
      <p className="text-[12px] text-[#5b5b5b] leading-relaxed mb-5">
        アプリの不具合や、使い方で分からないことをお送りください。
        <br />
        担当者が確認して、このページでお返事します。
      </p>

      <p className="text-[11px] font-bold text-[#004d40] mb-2">
        どんなことですか？
      </p>
      <div className="flex gap-1.5 mb-5">
        {SUPPORT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded-lg border-[1.5px] px-1 py-2.5 text-[11px] font-bold transition-colors ${
              kind === k
                ? "border-[#4a875b] bg-[#eaf3ec] text-[#2f6b41]"
                : "border-[#ded5c4] bg-[#fffdf8] text-[#6b6b6b]"
            }`}
          >
            {k === "使い方が分からない" ? "使い方" : k}
          </button>
        ))}
      </div>

      <p className="text-[11px] font-bold text-[#004d40] mb-2">
        どの画面のことですか？
      </p>
      <select
        value={screen}
        onChange={(e) => setScreen(e.target.value)}
        className="w-full border-[1.5px] border-[#ded5c4] bg-white rounded-lg px-3 py-2.5 text-[12.5px] text-[#2b2620] mb-5"
      >
        {SUPPORT_SCREENS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <p className="text-[11px] font-bold text-[#004d40] mb-2">
        詳しく教えてください
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="例）食事の写真を送ろうとすると、ぐるぐる回ったまま進みません。"
        className="w-full border-[1.5px] border-[#ded5c4] bg-white rounded-lg px-3 py-2.5 text-[12.5px] text-[#2b2620] placeholder:text-[#bdb5a6] mb-5 resize-none"
      />

      <p className="text-[11px] font-bold text-[#004d40] mb-2">
        画面の写真（任意）
      </p>
      <label className="flex items-center gap-2 border-[1.5px] border-[#ded5c4] bg-white rounded-lg px-3 py-2.5 mb-6 cursor-pointer">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="w-[18px] h-[18px] text-[#8aa894] shrink-0"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        <span className="flex-1 text-[12px] text-[#6b6b6b] truncate">
          {file ? file.name : "写真を選ぶ"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && (
        <p className="text-[12px] text-[#b3475b] leading-relaxed mb-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="btn3d w-full disabled:opacity-60"
      >
        {sending ? "送信中…" : "送信する"}
      </button>
    </form>
  );
}
