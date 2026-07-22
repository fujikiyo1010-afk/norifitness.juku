"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteCustomMenu } from "@/lib/workout/pool-actions";
import type { CustomMenuSummary } from "@/lib/workout/custom-queries";

/** じぶんメニュー棚の1行(今日やる/編集/⋮削除)。削除確認=モック画面11。 */
export function CustomMenuRow({ menu }: { menu: CustomMenuSummary }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const sub = [
    `${menu.exerciseCount}種目`,
    `${menu.setCount}セット`,
    menu.lastUsed ? `前回 ${menu.lastUsed}` : null,
  ]
    .filter(Boolean)
    .join(" ・ ");

  async function onDelete() {
    setBusy(true);
    await deleteCustomMenu(menu.id);
    setBusy(false);
    setConfirm(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5">
        <span className="flex h-[30px] flex-none items-center justify-center rounded-[9px] bg-[#7a5af0] px-2 text-[9px] font-extrabold text-white">
          じぶん
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[12.5px] text-[#2b2620]">{menu.name}</b>
          <span className="text-[10px] font-bold text-[#6a6256]">{sub}</span>
        </div>
        <Link href={`/workout/week/custom?record=${menu.id}`} className="flex-none rounded-full border-[1.5px] border-[#4a875b] px-2.5 py-1 text-[10px] font-extrabold text-[#34603f]">
          今日やる
        </Link>
        <Link href={`/workout/week/custom?edit=${menu.id}`} className="flex-none rounded-full border-[1.5px] border-[#d8cdba] px-2.5 py-1 text-[10px] font-extrabold text-[#6a6256]">
          編集
        </Link>
        <button type="button" onClick={() => setConfirm(true)} aria-label="削除" className="flex-none px-1 text-[16px] leading-none text-[#a59b8c]">
          ⋮
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-5" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-[340px] rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4" onClick={(e) => e.stopPropagation()}>
            <b className="text-[13px]">「{menu.name}」を削除しますか？</b>
            <p className="my-2 text-[11px] leading-relaxed text-[#6a6256]">
              過去の実施記録は消えません（棚から消えるだけ）。
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-[#e7dcc9] bg-white py-2.5 text-[12px] font-bold text-[#6a6256]">
                やめる
              </button>
              <button type="button" onClick={onDelete} disabled={busy} className="flex-1 rounded-lg bg-[#c2693f] py-2.5 text-[12px] font-bold text-white disabled:opacity-50">
                {busy ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
