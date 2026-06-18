"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminInfo } from "@/lib/auth/admin";
import type { ChatMessage } from "@/lib/chat/types";

// admin chat 専用 actions (= /lib/chat/actions.ts の sendMessageAsAdmin を共有する選択肢もあるが、
//                          画面別ファイルに揃えると見通し良いので再エクスポート相当)
export { sendMessageAsAdmin } from "@/lib/chat/actions";

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
