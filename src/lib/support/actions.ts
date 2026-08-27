"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";
import { isSupportUser } from "@/lib/auth/support-gate";

/**
 * お問い合わせ窓口(/support) 受講生側の書き込み (2026-08-27 新設)
 *
 * 通知は「きよむさんだけ」に飛ばす。
 * ★ sendPushToAllAdmins は使わない ─ のり氏にも飛んでしまい、
 *   「のり氏を伝言役から解放する」という今回の目的と真逆になるため。
 */

/** 通知先(管理画面で対応する人)。admin_users の email で引く。 */
const NOTIFY_ADMIN_EMAIL = "fujikiyo1010@gmail.com";

const MAX_BODY = 2000;

type CreateResult =
  | { ok: true; ticketId: string }
  | { ok: false; message: string };
type ActionResult = { ok: true } | { ok: false; message: string };

function validateBody(body: string): string | null {
  const trimmed = (body ?? "").trim();
  if (trimmed.length === 0) return "内容を入力してください";
  if (trimmed.length > MAX_BODY)
    return `内容は ${MAX_BODY} 文字以内で入力してください`;
  return null;
}

const PREVIEW_MAX = 60;
function shortPreview(text: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= PREVIEW_MAX ? t : t.slice(0, PREVIEW_MAX - 1) + "…";
}

/** きよむさんにだけ push。失敗しても送信自体は成功扱い(通知は付帯機能) */
async function notifyAdmin(
  title: string,
  body: string,
  ticketId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data: admin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", NOTIFY_ADMIN_EMAIL)
    .eq("is_active", true)
    .maybeSingle();
  const adminId = (admin as { id: string } | null)?.id;
  if (!adminId) return;
  await sendPushToUser(adminId, {
    title,
    body,
    url: `/admin/support/${ticketId}`,
    tag: `support-admin-${ticketId}`,
  });
}

/** 受講生名 (通知の見出し用。失敗しても止めない) */
async function getUserName(userId: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    return (data as { name?: string | null } | null)?.name ?? "受講生";
  } catch {
    return "受講生";
  }
}

/** 新しいお問い合わせを立てる (フォーム送信)。成功したらスレッドの id を返す */
export async function createTicket(input: {
  kind: string;
  screen: string | null;
  body: string;
  photoPath?: string | null;
  deviceInfo?: Record<string, unknown> | null;
}): Promise<CreateResult> {
  if (!(await isSupportUser()))
    return { ok: false, message: "現在ご利用いただけません" };

  const err = validateBody(input.body);
  if (err) return { ok: false, message: err };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      kind: input.kind,
      screen: input.screen,
      device_info: input.deviceInfo ?? null,
    })
    .select("id")
    .single();
  if (ticketError || !ticket)
    return {
      ok: false,
      message: ticketError?.message ?? "送信に失敗しました",
    };

  const ticketId = (ticket as { id: string }).id;

  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_kind: "user",
      sender_id: user.id,
      body: input.body.trim(),
      photo_path: input.photoPath ?? null,
    });
  if (messageError) return { ok: false, message: messageError.message };

  const name = await getUserName(user.id);
  void notifyAdmin(
    `${name} さんからお問い合わせ`,
    shortPreview(input.body),
    ticketId
  ).catch((e) => console.error("[support] push failed", e));

  revalidatePath("/support");
  return { ok: true, ticketId };
}

/** 既存スレッドへの追記 (解決済みには書けない) */
export async function addMessage(
  ticketId: string,
  body: string,
  photoPath?: string | null
): Promise<ActionResult> {
  if (!(await isSupportUser()))
    return { ok: false, message: "現在ご利用いただけません" };

  const err = validateBody(body);
  if (err) return { ok: false, message: err };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) return { ok: false, message: "お問い合わせが見つかりません" };
  if ((ticket as { status: string }).status === "resolved") {
    return {
      ok: false,
      message:
        "このお問い合わせは解決済みです。新しくお問い合わせをお送りください。",
    };
  }

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_kind: "user",
    sender_id: user.id,
    body: body.trim(),
    photo_path: photoPath ?? null,
  });
  if (error) return { ok: false, message: error.message };

  // 一覧の並びは「最後のやりとり順」を queries 側で計算する
  // (support_tickets に受講生の UPDATE ポリシーは無いので updated_at は触らない)

  const name = await getUserName(user.id);
  void notifyAdmin(
    `${name} さんから返信`,
    shortPreview(body),
    ticketId
  ).catch((e) => console.error("[support] push failed", e));

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true };
}
