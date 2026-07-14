"use client";

import { useState } from "react";

/**
 * クーポンコード＋右のコピーボタン。
 * 既定=書類2枚重ねのコピーアイコン(薄いグレー)。タップで clipboard にコピーし「済」に切り替わる(2秒で戻る)。
 */
export function CouponCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境でも壊さない(受講生には生エラーを見せない・ルール20④)
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-1 flex-col justify-center rounded-xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-2.5">
        <span className="text-[10px] font-bold text-[#9a917f]">
          筋肉塾ユーザー様専用クーポン
        </span>
        <span className="text-[19px] font-extrabold tracking-[0.12em] text-[#2b2620]">
          {code}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="クーポンコードをコピー"
        className="flex min-h-[52px] min-w-[56px] shrink-0 items-center justify-center rounded-xl border border-[#dcd6cb] bg-[#efece5] px-3 text-[#6a6256] transition-colors hover:bg-[#e6e2d9]"
      >
        {copied ? (
          <span className="text-[13px] font-extrabold text-[#4a875b]">済</span>
        ) : (
          <CopyIcon />
        )}
      </button>
    </div>
  );
}

// 書類2枚重ねのコピーアイコン(線画)
function CopyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
