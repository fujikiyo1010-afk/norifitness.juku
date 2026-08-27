"use client";

import { useEffect } from "react";
import { markTicketRead } from "@/lib/support/actions";

/**
 * スレッドを開いたら「読んだ」ことにする (2026-08-27)
 * ホーム右上の歯車の赤ドットと、設定の行の NEW ピルを消すための記録。
 * 解決済み(返信欄が出ない)でも印は消したいので、page.tsx 側に常に置く。
 */
export function MarkRead({ ticketId }: { ticketId: string }) {
  useEffect(() => {
    void markTicketRead(ticketId).catch(() => {});
  }, [ticketId]);
  return null;
}
