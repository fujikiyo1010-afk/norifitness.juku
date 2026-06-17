"use client";

import { useState, useTransition } from "react";
import { toggleEmailNotification } from "@/lib/account/actions";

/**
 * メール通知 ON/OFF トグル (2026-06-17 線① 設定画面)
 *
 * モック L155 と L160 のティール緑 / グレー 配色を踏襲。
 * 楽観 UI: クリック直後に見た目変更 → 失敗時のみロールバック。
 */
export function EmailNotificationToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleEmailNotification(next);
      if (!res.ok) {
        setEnabled(!next);
        alert(`通知設定の更新に失敗しました: ${res.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={enabled}
      aria-label={`メール通知を${enabled ? "オフ" : "オン"}にする`}
      disabled={pending}
      className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${
        enabled ? "bg-[#00897b] justify-end" : "bg-zinc-300 justify-start"
      } disabled:opacity-50`}
    >
      <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}
