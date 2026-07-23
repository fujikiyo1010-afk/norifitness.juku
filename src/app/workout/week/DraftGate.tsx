"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadDraft } from "./draft";

/**
 * 決定済み未完了(端末ローカルに当日ドラフトあり)ならメインでなく表紙へ復帰(§2-6/§3)。
 * 完了済(todayDone)は親がこのコンポーネントを出さない。日跨ぎの古いドラフトは loadDraft が破棄扱い。
 */
export function DraftGate({ todayKey }: { todayKey: string }) {
  const router = useRouter();
  useEffect(() => {
    if (loadDraft(todayKey)) router.replace("/workout/week/confirm");
  }, [todayKey, router]);
  return null;
}
