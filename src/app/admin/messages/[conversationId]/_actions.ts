"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminInfo } from "@/lib/auth/admin";
import type { ChatMessage } from "@/lib/chat/types";

/** admin ・特定 conversation の messages 全件取得 (= ポーリング用) */
export async function fetchMessagesForAdmin(
  conversationId: string
): Promise<ChatMessage[]> {
  const me = await getAdminInfo();
  if (!me) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ChatMessage[];
}
