"use client";

import { useTransition } from "react";
import { signOutFromAccount } from "@/lib/account/actions";

/**
 * ログアウトボタン (2026-06-17 線① 設定画面)
 *
 * モック L193 を踏襲: 白背景 + 薄枠 + 赤字。
 * 既存 src/app/login/actions.ts:36 signOut と同等の処理を /lib/account/actions.ts 経由で呼ぶ。
 */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    if (!confirm("ログアウトしますか?")) return;
    startTransition(async () => {
      await signOutFromAccount();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full bg-white border border-[#e8ebe9] rounded-2xl px-4 py-3 text-[13px] font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
    >
      {pending ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
