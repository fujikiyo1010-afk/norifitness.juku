"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";
import { toSubject } from "./queries";

/**
 * お問い合わせ窓口 ・ 管理側の書き込み (2026-08-27 新設)
 *
 * ★通知の宛先を間違えない: 受講生本人へ sendPushToUser。
 *   sendPushToAllAdmins は使わない(のり氏に飛び、窓口を1本化した目的と真逆になる)。
 * ★写真は必ず「その受講生の user_id フォルダ」に置く。
 *   管理者のフォルダに置くと、バケットの権限の作り上、受講生本人が見られなくなる。
 */

type Result = { ok: true } | { ok: false; message: string };

const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

function refresh(ticketId: string) {
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin", "layout"); // サイドバーの赤バッジ
}

/**
 * 返信を保存する。
 *  1) support_messages に admin の行を足す(写真があれば受講生フォルダへ上げる)
 *  2) status を in_progress へ(= 相手の番。未対応タブとバッジから外れる)
 *  3) 受講生本人へプッシュ通知
 */
export async function replySupportTicket(
  ticketId: string,
  formData: FormData
): Promise<Result> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const body = String(formData.get("body") ?? "").trim();
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (!body && !hasPhoto) return { ok: false, message: "本文を入力してください" };
  if (hasPhoto && photo.size > PHOTO_MAX_BYTES) {
    return { ok: false, message: "画像が大きすぎます" };
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return { ok: false, message: "この問い合わせは見つかりませんでした" };
  const t = ticket as { id: string; user_id: string | null; status: string };

  // 写真は受講生の user_id フォルダへ(所有者フォルダ規則)。アプリ外(user_id なし)は写真なし。
  let photoPath: string | null = null;
  if (hasPhoto) {
    if (!t.user_id) return { ok: false, message: "この問い合わせには写真を送れません" };
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    photoPath = `${t.user_id}/${name}`;
    const { error: upErr } = await supabase.storage
      .from("support-photos")
      .upload(photoPath, photo, { contentType: "image/jpeg", upsert: false });
    if (upErr) return { ok: false, message: "画像の送信に失敗しました" };
  }

  const { error: insErr } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_kind: "admin",
    sender_id: admin.id,
    // body は空にできない(受講生側と同じ扱い)
    body: body || "（写真を送りました）",
    photo_path: photoPath,
  });
  if (insErr) return { ok: false, message: "返信の保存に失敗しました" };

  // 返信したので「相手の番」へ。解決済みの件は状態を動かさない。
  if (t.status !== "resolved") {
    await supabase
      .from("support_tickets")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", ticketId);
  }

  // 受講生本人へ通知(失敗しても返信自体は成立させる)
  if (t.user_id) {
    try {
      const sv = createAdminClient();
      const { data: first } = await sv
        .from("support_messages")
        .select("body")
        .eq("ticket_id", ticketId)
        .eq("sender_kind", "user")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      await sendPushToUser(t.user_id, {
        title: "お問い合わせにお返事があります",
        body: toSubject((first as { body?: string } | null)?.body ?? ""),
        url: `/support/${ticketId}`,
        tag: `support-user-${ticketId}`,
      });
    } catch {
      // 通知は補助。ここで失敗しても返信は保存済み。
    }
  }

  refresh(ticketId);
  return { ok: true };
}

/** 解決済みにする(=会話を閉じる。受講生の入力欄が消える) */
export async function resolveSupportTicket(ticketId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { ok: false, message: "状態の更新に失敗しました" };
  refresh(ticketId);
  return { ok: true };
}

/** 解決済みを取り消して対応中に戻す(受講生がまた書けるようになる) */
export async function reopenSupportTicket(ticketId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { ok: false, message: "状態の更新に失敗しました" };
  refresh(ticketId);
  return { ok: true };
}
