import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signChatImages } from "./image-sign";
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
  return signChatImages((data ?? []) as ChatMessage[]);
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

/**
 * 会話ごとの「未対応」状態を計算(ホーム警報 alerts.ts と同じ考え方＝統一)。
 * 未対応 = 受講生の発言のうち、こちらの「最後の返信」と「完了(admin_chat_acks.acked_at)」の
 * どちらよりも後に届いたものがある状態。開いただけでは変わらない(last_read_at_admin は使わない)。
 * 返信する / 完了ボタンを押す のどちらかで解消し、受講生が新しく送ると再び未対応に戻る。
 */
type MsgMeta = { conversation_id: string; sender_kind: string; created_at: string };
type ConvState = {
  unhandled: boolean;
  unread: number; // 未対応の受講生メッセージ数(=最後の対応より後の受講生発言)
  lastSender: "user" | "admin" | null;
};
function computeConvStates(
  msgs: MsgMeta[],
  ackByUser: Map<string, string>,
  userIdByConv: Map<string, string>
): Map<string, ConvState> {
  const byConv = new Map<string, MsgMeta[]>();
  for (const m of msgs) {
    const arr = byConv.get(m.conversation_id) ?? [];
    arr.push(m);
    byConv.set(m.conversation_id, arr);
  }
  const out = new Map<string, ConvState>();
  for (const [cid, list] of byConv) {
    let lastAdminMs = 0;
    let last: MsgMeta | null = null;
    for (const m of list) {
      if (!last || m.created_at > last.created_at) last = m;
      if (m.sender_kind === "admin") {
        const t = Date.parse(m.created_at);
        if (t > lastAdminMs) lastAdminMs = t;
      }
    }
    const uid = userIdByConv.get(cid);
    const ackedAt = uid ? ackByUser.get(uid) : undefined;
    const handledMs = Math.max(lastAdminMs, ackedAt ? Date.parse(ackedAt) : 0);
    let unread = 0;
    for (const m of list) {
      if (m.sender_kind === "user" && Date.parse(m.created_at) > handledMs) unread++;
    }
    out.set(cid, {
      unhandled: unread > 0,
      unread,
      lastSender: (last?.sender_kind as "user" | "admin" | null) ?? null,
    });
  }
  return out;
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

  const userIds = conversations.map((c) => c.user_id);
  const userIdByConv = new Map(conversations.map((c) => [c.id, c.user_id]));

  // 氏名 / 完了(ack) / 全メッセージ を1波で取得(N+1回避・alerts.ts と同方式)。
  const [{ data: users }, { data: acks }, { data: msgs }] = await Promise.all([
    admin.from("users").select("id, name, email").in("id", userIds),
    admin.from("admin_chat_acks").select("user_id, acked_at"),
    admin
      .from("messages")
      .select("conversation_id, sender_kind, created_at, body")
      .order("created_at", { ascending: true }),
  ]);

  const userMap = new Map(
    ((users ?? []) as { id: string; name: string | null; email: string }[]).map(
      (u) => [u.id, { name: u.name ?? "(氏名未設定)", email: u.email }]
    )
  );
  const ackByUser = new Map<string, string>();
  for (const a of (acks ?? []) as { user_id: string; acked_at: string }[]) {
    ackByUser.set(a.user_id, a.acked_at);
  }

  const allMsgs = (msgs ?? []) as (MsgMeta & { body: string | null })[];
  const states = computeConvStates(allMsgs, ackByUser, userIdByConv);
  // 昇順取得なので、会話ごとに最後に上書きされる本文 = 最新メッセージ本文。
  const lastBodyByConv = new Map<string, string | null>();
  for (const m of allMsgs) lastBodyByConv.set(m.conversation_id, m.body);

  return conversations.map((conv) => {
    const u = userMap.get(conv.user_id);
    const st = states.get(conv.id) ?? {
      unhandled: false,
      unread: 0,
      lastSender: null as "user" | "admin" | null,
    };
    return {
      conversation: conv,
      user_name: u?.name ?? "(削除済受講生)",
      user_email: u?.email ?? "",
      last_message_body: lastBodyByConv.get(conv.id) ?? null,
      last_message_sender: st.lastSender,
      unread_count: st.unread,
      unhandled: st.unhandled,
    };
  });
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
    messages: await signChatImages((messages ?? []) as ChatMessage[]),
  };
}

/**
 * admin 視点 ・「未対応」の会話 人数 (= サイドバー赤バッジ / ホーム連動)。
 * 会話数(=人数)を返す。未読“メッセージ本数”ではなく、対応が要る受講生の人数。
 */
export async function getAdminUnhandledConvCount(): Promise<number> {
  const admin = createAdminClient();
  const { data: convs } = await admin
    .from("conversations")
    .select("id, user_id");
  const conversations = (convs ?? []) as { id: string; user_id: string }[];
  if (conversations.length === 0) return 0;
  const userIdByConv = new Map(conversations.map((c) => [c.id, c.user_id]));

  const [{ data: acks }, { data: msgs }] = await Promise.all([
    admin.from("admin_chat_acks").select("user_id, acked_at"),
    admin.from("messages").select("conversation_id, sender_kind, created_at"),
  ]);
  const ackByUser = new Map<string, string>();
  for (const a of (acks ?? []) as { user_id: string; acked_at: string }[]) {
    ackByUser.set(a.user_id, a.acked_at);
  }
  const states = computeConvStates(
    (msgs ?? []) as MsgMeta[],
    ackByUser,
    userIdByConv
  );
  let n = 0;
  for (const st of states.values()) if (st.unhandled) n++;
  return n;
}

/**
 * admin 視点 ・user_id からその受講生の会話を取得(なければ作成)。
 * 個別ハブ / デイリー添削 → その人のチャットへ直接飛ぶための解決に使う。
 */
export async function getOrCreateConversationForUserAsAdmin(
  userId: string
): Promise<Conversation | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as Conversation;
  const { data: created } = await admin
    .from("conversations")
    .insert({ user_id: userId })
    .select("*")
    .single();
  return (created as Conversation | null) ?? null;
}
