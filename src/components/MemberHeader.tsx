"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 受講生 UI 共通アプリヘッダー (モック準拠)
 *
 * 構造: < / センタータイトル / 右アイコン (3 列グリッド)
 *
 * 戻るボタン:
 *   - ブラウザ履歴があれば router.back()
 *   - 直リンクで履歴がなければ fallbackHref へ
 *
 * 使い方:
 *   <MemberHeader title="コース" />
 *   <MemberHeader title="レッスン" rightIcon={<MoreIcon />} fallbackHref="/courses/abc" />
 *
 * ホーム (/) は v4 独自ヘッダーを使うのでこれは使わない。
 */
export function MemberHeader({
  title,
  rightIcon,
  fallbackHref = "/",
}: {
  title: string;
  rightIcon?: ReactNode;
  fallbackHref?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <header className="bg-[#fffdf8] border-b border-[#e7dcc9] sticky top-0 z-10 grid grid-cols-[32px_1fr_32px] items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={handleBack}
        aria-label="戻る"
        className="w-8 h-8 flex items-center justify-center text-[#2b2620] hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-center text-sm font-bold text-[#004d40] truncate">
        {title}
      </h1>
      <div className="w-8 h-8 flex items-center justify-center text-[#6a6256]">
        {rightIcon}
      </div>
    </header>
  );
}
