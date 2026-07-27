"use client";

import { useTransition } from "react";
import { signOutFromAccount } from "@/lib/account/actions";

/**
 * ログアウトボタン (2026-06-17 線① 設定画面)
 *
 * モック L193 を踏襲: 白背景 + 薄枠 + 赤字。
 * 既存 src/app/login/actions.ts:36 signOut と同等の処理を /lib/account/actions.ts 経由で呼ぶ。
 */
export function LogoutButton({ variant = "card" }: { variant?: "card" | "row" }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    if (!confirm("ログアウトしますか?")) return;
    startTransition(async () => {
      await signOutFromAccount();
    });
  }

  // row: プロフィール画面「各種メニュー」カード内の1行として溶け込ませる版
  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-3.5 w-full px-[18px] py-4 text-left text-[15.5px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
      >
        <svg
          className="w-[21px] h-[21px] flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="flex-1">{pending ? "ログアウト中..." : "ログアウト"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3 text-[13px] font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
    >
      {pending ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
