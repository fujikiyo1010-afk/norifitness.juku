"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminInfo } from "@/lib/auth/admin";
import { sendPushToUser, sendPushToAllAdmins } from "@/lib/push/send";
import { signChatImages } from "./image-sign";
import { isServiceExpiredUser } from "@/lib/auth/service-expired";
import { jstTodayStr } from "@/lib/date/jst";
import type { ChatMessage } from "./types";

const PREVIEW_MAX = 80;
function shortPreview(text: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= PREVIEW_MAX ? t : t.slice(0, PREVIEW_MAX - 1) + "…";
}

type ActionResult = { ok: true } | { ok: false; message: string };
type SendResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; message: string };

const MAX_BODY = 2000;

function validateBody(body: string): string | null {
  const trimmed = (body ?? "").trim();
  if (trimmed.length === 0) return "メッセージを入力してください";
  if (trimmed.length > MAX_BODY)
    return `メッセージは ${MAX_BODY} 文字以内で入力してください`;
  return null;
}

/** 受講生 ・自分の conversation にメッセージ送信。 成功時は message 行を返す (= 楽観的 UI 更新用) */
export async function sendMessageAsUser(body: string): Promise<SendResult> {
  const err = validateBody(body);
  if (err) return { ok: false, message: err };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  // conversation 取得 or 作成
  let conversationId: string | null = null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    conversationId = (existing as { id: string }).id;
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    conversationId = (created as { id: string } | null)?.id ?? null;
  }
  if (!conversationId)
    return { ok: false, message: "会話の作成に失敗しました" };

  // サービス満了: 送信は1日2通まで(JST・受信と過去の閲覧は無制限) 2026-08-26 C2
  if (await isServiceExpiredUser()) {
    const todayStartJst = new Date(`${jstTodayStr()}T00:00:00+09:00`).toISOString();
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender_kind", "user")
      .gte("created_at", todayStartJst);
    if ((count ?? 0) >= 2) {
      return {
        ok: false,
        message:
          "サポート期間終了後のメッセージは1日2通までとなっています。また明日お送りください。",
      };
    }
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_kind: "user",
      sender_id: user.id,
      body: body.trim(),
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  // 全 active admin に push 通知 (= のり氏に即気付かせる)
  // 受講生氏名 取得 (DB を 1 件読むだけなので安価、 失敗してもメッセージ送信は成功扱い)
  try {
    const { data: profile } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const senderName =
      (profile as { name?: string | null } | null)?.name ?? "受講生";
    void sendPushToAllAdmins({
      title: `${senderName} さんからメッセージ`,
      body: shortPreview(body),
      url: `/admin/messages/${conversationId}`,
      tag: `chat-admin-${conversationId}`,
    }).catch((e) => console.error("[push] chat→admin failed", e));
  } catch (e) {
    console.error("[push] chat→admin lookup failed", e);
  }

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  return { ok: true, message: data as ChatMessage };
}

/** admin ・特定 conversation にメッセージ送信。 成功時は message 行を返す (= 楽観的 UI 更新用) */
export async function sendMessageAsAdmin(
  conversationId: string,
  body: string
): Promise<SendResult> {
  const err = validateBody(body);
  if (err) return { ok: false, message: err };

  const me = await getAdminInfo();
  if (!me) return { ok: false, message: "管理者権限が必要です" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_kind: "admin",
      sender_id: me.id,
      body: body.trim(),
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  // 受講生に push 通知 (= LINE 風に即座に届く)
  try {
    const { data: conv } = await admin
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();
    const targetUserId = (conv as { user_id?: string } | null)?.user_id;
    if (targetUserId) {
      void sendPushToUser(targetUserId, {
        title: "のりfitness から新着メッセージ",
        body: shortPreview(body),
        url: "/messages",
        tag: "chat-user",
      }).catch((e) => console.error("[push] chat→user failed", e));
    }
  } catch (e) {
    console.error("[push] chat→user lookup failed", e);
  }

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  return { ok: true, message: data as ChatMessage };
}

/**
 * 管理者 ・画像メッセージ送信(段4)。クライアントで圧縮済みの フル+サムネ を受け取り、
 * 非公開バケット chat-images にアップロード → 画像付きメッセージを作成 → 署名URL付きで返す。
 * 画像は管理者→受講生の一方向。30日で cron 削除。
 */
export async function sendImageMessageAsAdmin(
  conversationId: string,
  formData: FormData
): Promise<SendResult> {
  const me = await getAdminInfo();
  if (!me) return { ok: false, message: "管理者権限が必要です" };

  const full = formData.get("full");
  const thumb = formData.get("thumb");
  const caption = ((formData.get("caption") as string | null) ?? "").trim();
  if (!(full instanceof File)) {
    return { ok: false, message: "画像がありません" };
  }

  const admin = createAdminClient();
  const base = `${conversationId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const fullPath = `${base}.jpg`;
  const thumbPath = `${base}_t.jpg`;

  const up1 = await admin.storage
    .from("chat-images")
    .upload(fullPath, full, { contentType: "image/jpeg", upsert: false });
  if (up1.error) return { ok: false, message: up1.error.message };

  let thumbOk = false;
  if (thumb instanceof File) {
    const up2 = await admin.storage
      .from("chat-images")
      .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
    thumbOk = !up2.error;
  }

  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_kind: "admin",
      sender_id: me.id,
      body: caption,
      image_path: fullPath,
      image_thumb_path: thumbOk ? thumbPath : null,
    })
    .select("*")
    .single();
  if (error) {
    // 後始末: 挿入失敗ならアップした画像を消す
    await admin.storage
      .from("chat-images")
      .remove([fullPath, ...(thumbOk ? [thumbPath] : [])]);
    return { ok: false, message: error.message };
  }

  // 受講生へ push 通知
  try {
    const { data: conv } = await admin
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();
    const targetUserId = (conv as { user_id?: string } | null)?.user_id;
    if (targetUserId) {
      void sendPushToUser(targetUserId, {
        title: "のりfitness から新着メッセージ",
        body: caption ? shortPreview(caption) : "📷 画像が届きました",
        url: "/messages",
        tag: "chat-user",
      }).catch((e) => console.error("[push] chat img→user failed", e));
    }
  } catch (e) {
    console.error("[push] chat img lookup failed", e);
  }

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  const [signed] = await signChatImages([data as ChatMessage]);
  return { ok: true, message: signed };
}

/** 受講生 ・自分の conversation の messages 全件取得 (= ポーリング用、 Realtime フォールバック) */
export async function fetchMyLatestMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 自分の conversation かどうか念のため検証 (RLS でも守られるが)
  const { data: conv } = await supabase
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || (conv as { user_id: string }).user_id !== user.id) return [];

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return signChatImages((data ?? []) as ChatMessage[]);
}

/** 受講生 ・既読をセット */
export async function markReadAsUser(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { error } = await supabase
    .from("conversations")
    .update({ last_read_at_user: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  revalidatePath("/messages");
  return { ok: true };
}

/** admin ・特定 conversation を既読にセット */
export async function markReadAsAdmin(
  conversationId: string
): Promise<ActionResult> {
  const me = await getAdminInfo();
  if (!me) return { ok: false, message: "管理者権限が必要です" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("conversations")
    .update({ last_read_at_admin: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  return { ok: true };
}
