"use client";

import { useEffect } from "react";
import { clearDraft } from "./draft";

/**
 * ②-B(2026-07-29): メイン(/workout/week)に着いたら、未完了の下書きを破棄する。
 * 「保存を持ち越さない」担保。旧 DraftGate(下書きがあると表紙へ強制送還)を置き換える。
 * 流れ(メイン→セット表→表紙)は決定時に下書きを作るので、メイン着地での破棄は妨げにならない。
 */
export function ClearDraftOnMain({ todayKey }: { todayKey: string }) {
  useEffect(() => {
    clearDraft(todayKey);
  }, [todayKey]);
  return null;
}
