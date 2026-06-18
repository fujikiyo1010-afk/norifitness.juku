"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAnnouncementBatch } from "@/lib/email/announcement";

/**
 * 一斉アナウンス Server Actions (2026-06-18 C-1 ・ 線①)
 *
 * - createAnnouncementDraft : 下書き作成 (= 送信前確認画面用)
 * - sendAnnouncement        : 実送信 (= Resend で全 active 受講生に bcc 配信、 status=sent)
 *
 * 設計方針:
 *   - 「下書き」 と 「送信」 を明確に分離 → 誤送信防止
 *   - audience は 'all_active' のみ (= 線①、 セグメント分けは線②)
 *   - include_opt_out_users で 「メール OFF の人にも送るか」 を制御
 *     (規約改定 / インシデント告知 では true 推奨)
 */

type DraftInput = {
  subject: string;
  body_text: string;
  include_opt_out_users: boolean;
};

type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export async function createAnnouncementDraft(
  input: DraftInput
): Promise<ActionResult<{ id: string }>> {
  const subject = (input.subject ?? "").trim();
  const body = (input.body_text ?? "").trim();
  if (!subject) return { ok: false, message: "件名を入力してください" };
  if (subject.length > 200)
    return { ok: false, message: "件名は 200 文字以内にしてください" };
  if (!body) return { ok: false, message: "本文を入力してください" };
  if (body.length > 20000)
    return { ok: false, message: "本文は 20000 文字以内にしてください" };

  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      subject,
      body_text: body,
      audience: "all_active",
      include_opt_out_users: !!input.include_opt_out_users,
      status: "draft",
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/announcements");
  return { ok: true, id: data.id as string };
}

export async function sendAnnouncement(
  id: string
): Promise<ActionResult<{ recipient_count: number }>> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // ① 下書き取得 + 二重送信防止
  const { data: row, error: fetchError } = await supabase
    .from("announcements")
    .select("id, subject, body_text, include_opt_out_users, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, message: fetchError.message };
  if (!row) return { ok: false, message: "アナウンスが見つかりません" };
  if ((row as { status?: string }).status === "sent") {
    return { ok: false, message: "このアナウンスは既に送信済です" };
  }

  // ② 配信対象取得 (active 受講生 + email_notification_enabled 制御)
  let q = supabase
    .from("users")
    .select("id, email, email_notification_enabled")
    .eq("status", "active");
  if (!row.include_opt_out_users) {
    q = q.neq("email_notification_enabled", false);
  }
  const { data: users, error: usersError } = await q;
  if (usersError) return { ok: false, message: usersError.message };
  const recipients = (users ?? [])
    .map((u) => (u as { email?: string | null }).email)
    .filter((e): e is string => !!e);
  if (recipients.length === 0) {
    return { ok: false, message: "配信対象がいません" };
  }

  // ③ 送信 (Resend バッチ送信)
  const result = await sendAnnouncementBatch({
    subject: row.subject as string,
    body: row.body_text as string,
    recipients,
  });
  if (!result.ok) {
    return { ok: false, message: `送信失敗: ${result.error}` };
  }

  // ④ status=sent に確定
  const { error: updateError } = await supabase
    .from("announcements")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: admin.id,
      recipient_count: recipients.length,
    })
    .eq("id", id);
  if (updateError) {
    // 送信は成功しているので警告のみ
    console.error("[announcement] sent but status update failed", updateError);
  }

  revalidatePath("/admin/announcements");
  revalidatePath(`/admin/announcements/${id}`);
  return { ok: true, recipient_count: recipients.length };
}

export async function sendAnnouncementAndRedirect(id: string) {
  const r = await sendAnnouncement(id);
  if (r.ok) {
    redirect("/admin/announcements");
  }
  return r;
}
