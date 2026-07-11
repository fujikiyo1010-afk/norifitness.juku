import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Conversation,
  ChatMessage,
  AdminConversationRow,
} from "./types";

/**
 * 受講生視点 ・自分の conversation を取得 (なければ作成)
 * 1 受講生 = 1 conversation
 */
export async function getOrCreateMyConversation(): Promise<Conversation | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const { data: created } = await supabase
    .from("conversations")
    .insert({ user_id: user.id })
    .select("*")
    .single();
  return (created as Conversation | null) ?? null;
}

/** 受講生視点 ・指定 conversation の messages を時系列で取得 */
export async function listMyMessages(
  conversationId: string,
  limit = 100
): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as ChatMessage[];
}

/** 受講生視点 ・未読数 (admin 発で last_read_at_user 以降のもの) */
export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, last_read_at_user")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conv) return 0;

  const c = conv as { id: string; last_read_at_user: string | null };
  let q = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", c.id)
    .eq("sender_kind", "admin");
  if (c.last_read_at_user) {
    q = q.gt("created_at", c.last_read_at_user);
  }
  const { count } = await q;
  return count ?? 0;
}

/** admin 視点 ・全 conversation 一覧 (= 受信箱) ・新着順 */
export async function listConversationsForAdmin(): Promise<
  AdminConversationRow[]
> {
  const admin = createAdminClient();
  const { data: convs } = await admin
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false });
  const conversations = (convs ?? []) as Conversation[];
  if (conversations.length === 0) return [];

  // user_id → user_name + email
  const userIds = conversations.map((c) => c.user_id);
  const { data: users } = await admin
    .from("users")
    .select("id, name, email")
    .in("id", userIds);
  const userMap = new Map(
    ((users ?? []) as { id: string; name: string | null; email: string }[]).map(
      (u) => [u.id, { name: u.name ?? "(氏名未設定)", email: u.email }]
    )
  );

  // 各 conv の最新メッセージ + 未読数。
  // S2(N+1解消): 会話ごとに直列2クエリ×N本 → 会話間も会話内も並列化して1波に(順序・値は不変)。
  const results: AdminConversationRow[] = await Promise.all(
    conversations.map(async (conv) => {
      const u = userMap.get(conv.user_id);
      let unreadQ = admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("sender_kind", "user");
      if (conv.last_read_at_admin) {
        unreadQ = unreadQ.gt("created_at", conv.last_read_at_admin);
      }
      const [{ data: lastMsg }, { count: unread }] = await Promise.all([
        admin
          .from("messages")
          .select("body, sender_kind")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        unreadQ,
      ]);
      return {
        conversation: conv,
        user_name: u?.name ?? "(削除済受講生)",
        user_email: u?.email ?? "",
        last_message_body: (lastMsg?.body as string | null) ?? null,
        last_message_sender:
          (lastMsg?.sender_kind as "user" | "admin" | null) ?? null,
        unread_count: unread ?? 0,
      };
    })
  );
  return results;
}

/** admin 視点 ・特定 conversation の messages を取得 + 受講生情報 */
export async function getConversationForAdmin(
  conversationId: string
): Promise<{
  conversation: Conversation;
  user_name: string;
  user_email: string;
  user_id: string;
  messages: ChatMessage[];
} | null> {
  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  const conversation = conv as Conversation;

  const { data: user } = await admin
    .from("users")
    .select("id, name, email")
    .eq("id", conversation.user_id)
    .maybeSingle();

  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return {
    conversation,
    user_name:
      (user as { name?: string | null } | null)?.name ?? "(氏名未設定)",
    user_email: (user as { email?: string } | null)?.email ?? "",
    user_id: conversation.user_id,
    messages: (messages ?? []) as ChatMessage[],
  };
}

/** admin 視点 ・全 conversation の合計未読数 (= ホーム KPI 用) */
export async function getAdminTotalUnreadCount(): Promise<number> {
  const admin = createAdminClient();
  const { data: convs } = await admin
    .from("conversations")
    .select("id, last_read_at_admin");
  const conversations =
    (convs ?? []) as { id: string; last_read_at_admin: string | null }[];
  if (conversations.length === 0) return 0;

  let total = 0;
  for (const c of conversations) {
    let q = admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .eq("sender_kind", "user");
    if (c.last_read_at_admin) {
      q = q.gt("created_at", c.last_read_at_admin);
    }
    const { count } = await q;
    total += count ?? 0;
  }
  return total;
}
