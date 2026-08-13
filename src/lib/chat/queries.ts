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
 * 会話1件が「未対応」か(段5・非正規化ベース＝全メッセージを読まない)。
 * 未対応 = 最新メッセージが受講生発 かつ 完了(admin_chat_acks.acked_at)がそれより前(または未完了)。
 * 「最後の返信より後か」は、返信すると last_message_sender が 'admin' になることで自動的に成立
 * (＝last_message_sender='user' の時点で、こちらの最後の返信より後の受講生発言がある)。
 * ホーム警報 alerts.ts と同じ考え方。開いただけでは変わらない。
 */
function isConvUnhandled(
  lastSender: "user" | "admin" | null | undefined,
  lastMessageAt: string,
  ackedAt: string | undefined
): boolean {
  if (lastSender !== "user") return false;
  if (!ackedAt) return true;
  return Date.parse(ackedAt) < Date.parse(lastMessageAt);
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

  // 氏名 と 完了(ack) だけ取得(メッセージは読まない＝総件数に依存しない)。
  const [{ data: users }, { data: acks }] = await Promise.all([
    admin.from("users").select("id, name, email").in("id", userIds),
    admin.from("admin_chat_acks").select("user_id, acked_at"),
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

  return conversations.map((conv) => {
    const u = userMap.get(conv.user_id);
    const lastSender = conv.last_message_sender ?? null;
    return {
      conversation: conv,
      user_name: u?.name ?? "(削除済受講生)",
      user_email: u?.email ?? "",
      last_message_body: conv.last_message_body ?? null,
      last_message_sender: lastSender,
      unread_count: 0, // 軽量化のため件数は出さない(未対応は unhandled の強調で表現)
      unhandled: isConvUnhandled(
        lastSender,
        conv.last_message_at,
        ackByUser.get(conv.user_id)
      ),
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
  // 会話(最新sender/時刻)と ack だけ(メッセージは読まない＝総件数に依存しない)。
  const [{ data: convs }, { data: acks }] = await Promise.all([
    admin
      .from("conversations")
      .select("user_id, last_message_at, last_message_sender"),
    admin.from("admin_chat_acks").select("user_id, acked_at"),
  ]);
  const ackByUser = new Map<string, string>();
  for (const a of (acks ?? []) as { user_id: string; acked_at: string }[]) {
    ackByUser.set(a.user_id, a.acked_at);
  }
  let n = 0;
  for (const c of (convs ?? []) as {
    user_id: string;
    last_message_at: string;
    last_message_sender: "user" | "admin" | null;
  }[]) {
    if (
      isConvUnhandled(c.last_message_sender, c.last_message_at, ackByUser.get(c.user_id))
    ) {
      n++;
    }
  }
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
