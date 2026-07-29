"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearDraft } from "./draft";

/**
 * ②-B(2026-07-29): 週間トレのセット表/表紙から「流れの外」へ出る時に破棄確認を出す。
 *
 * 捕まえる離脱口:
 *   - ヘッダー戻る「<」(button[aria-label="戻る"])
 *   - 下部ナビ(.member-nav 内の a)
 *   - OS/ブラウザの戻る(popstate)
 * 流れ内の移動(決定する/修正する/完了する 等のボタン=router遷移)は捕まえない。
 *
 * robust(前回の無限ループ回避): 実際の遷移は必ず router.push/replace で決め打ちし、
 * history.back()/go() は使わない(=戻り操作を自分で再発火しない)。sentinel は
 * OS戻りを「捕まえて確認を出す」ためだけに使い、確認後の遷移は router に任せる。
 */
export function FlowLeaveGuard({
  active,
  backHref,
  todayKey,
}: {
  active: boolean;
  backHref: string;
  todayKey: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const destRef = useRef<string>("");
  const leftRef = useRef(false);

  // OS戻る(popstate)を捕まえる sentinel(履歴に見えない1段を置く)
  useEffect(() => {
    if (!active) return;
    window.history.pushState({ __wkGuard: 1 }, "");
    function onPop() {
      if (leftRef.current) return; // 自分の遷移由来は無視(念のため)
      // 戻るが押された(sentinelが消費された) → 再武装して確認を出す
      window.history.pushState({ __wkGuard: 1 }, "");
      destRef.current = backHref;
      setOpen(true);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active, backHref]);

  // ヘッダー戻る / 下部ナビ のクリックを捕まえる(キャプチャ段で先取り)
  useEffect(() => {
    if (!active) return;
    function onClick(e: MouseEvent) {
      if (open) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return;
      const backBtn = t.closest('button[aria-label="戻る"]');
      const anchor = t.closest("a[href]") as HTMLAnchorElement | null;
      let dest = "";
      if (backBtn) dest = backHref;
      else if (anchor && anchor.closest(".member-nav")) dest = anchor.getAttribute("href") || "";
      else return;
      if (!dest) return;
      e.preventDefault();
      e.stopPropagation();
      destRef.current = dest;
      setOpen(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, backHref, open]);

  function stay() {
    setOpen(false);
    destRef.current = "";
  }

  function leave() {
    const dest = destRef.current || backHref;
    setOpen(false);
    leftRef.current = true;
    clearDraft(todayKey); // 未完了の下書きは破棄
    // 戻り系は replace(現在の見えない1段を置換=履歴を汚さない)、下ナビは push。
    if (dest === backHref) router.replace(dest);
    else router.push(dest);
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-[14px] font-extrabold text-[#2b2620]">編集中の内容を破棄して移動しますか？</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#6a6256]">
          まだ完了していないため、移動すると入力した内容は保存されません。
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={leave}
            className="w-full rounded-xl border-2 border-[#c2693f] py-2.5 text-[13px] font-extrabold text-[#b0532c]"
          >
            移動する（破棄）
          </button>
          <button
            type="button"
            onClick={stay}
            className="w-full rounded-xl bg-[#eef2ee] py-2.5 text-[13px] font-extrabold text-[#34603f]"
          >
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}
