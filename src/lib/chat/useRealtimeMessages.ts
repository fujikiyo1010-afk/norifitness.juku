"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "./types";

/**
 * 指定 conversation の messages 新着を Realtime 購読 (2026-06-18 #2)
 *
 * - postgres_changes (INSERT) を subscribe
 * - 新しい message が来たら onNew(message) を呼ぶ
 * - cleanup で channel.unsubscribe
 *
 * 注意: Supabase Realtime は Pro 以上で安定運用。 Free でも動くが接続数制限あり。
 */
export function useRealtimeMessages(
  conversationId: string | null,
  onNew: (msg: ChatMessage) => void
): void {
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          onNew(msg);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, onNew]);
}
