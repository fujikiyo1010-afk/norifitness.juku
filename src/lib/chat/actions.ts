"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminInfo } from "@/lib/auth/admin";

type ActionResult = { ok: true } | { ok: false; message: string };

const MAX_BODY = 2000;

function validateBody(body: string): string | null {
  const trimmed = (body ?? "").trim();
  if (trimmed.length === 0) return "メッセージを入力してください";
  if (trimmed.length > MAX_BODY)
    return `メッセージは ${MAX_BODY} 文字以内で入力してください`;
  return null;
}

/** 受講生 ・自分の conversation にメッセージ送信 */
export async function sendMessageAsUser(body: string): Promise<ActionResult> {
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

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_kind: "user",
    sender_id: user.id,
    body: body.trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  return { ok: true };
}

/** admin ・特定 conversation にメッセージ送信 */
export async function sendMessageAsAdmin(
  conversationId: string,
  body: string
): Promise<ActionResult> {
  const err = validateBody(body);
  if (err) return { ok: false, message: err };

  const me = await getAdminInfo();
  if (!me) return { ok: false, message: "管理者権限が必要です" };

  const admin = createAdminClient();
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_kind: "admin",
    sender_id: me.id,
    body: body.trim(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  return { ok: true };
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
