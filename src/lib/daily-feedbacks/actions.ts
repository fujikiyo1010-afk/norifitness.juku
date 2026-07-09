"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * デイリー添削の日次フィードバック 送信 / スキップ（P2a v1）。
 * daily_feedbacks は UNIQUE(user_id, date)。同日は upsert で上書き。
 */

export type DailyFbResult = { ok: true } | { ok: false; message: string };

async function upsert(
  userId: string,
  date: string,
  body: string | null,
  status: "sent" | "skipped",
  adminId: string
): Promise<DailyFbResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("daily_feedbacks").upsert(
    {
      user_id: userId,
      date,
      body,
      status,
      admin_id: adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/daily");
  return { ok: true };
}

export async function sendDailyFeedback(input: {
  userId: string;
  date: string;
  body: string;
}): Promise<DailyFbResult> {
  const adminInfo = await requireAdmin();
  const body = input.body.trim();
  if (!body) return { ok: false, message: "フィードバックを入力してください" };
  const r = await upsert(input.userId, input.date, body, "sent", adminInfo.id);
  // P2b-2: 受講生ホームの緑バッジ「返信あり」用に通知を1件立てる（既存 notifications・種類=comment）。
  // 未読が既にあれば増やさない（バッジは有無だけを見るため重複不要）。送信失敗時は立てない。
  if (r.ok) await ensureReplyNotification(input.userId);
  return r;
}

/** 未読の「のりの返信(comment)」通知が無ければ1件作る（重複防止）。 */
async function ensureReplyNotification(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "comment")
    .eq("is_read", false)
    .limit(1)
    .maybeSingle();
  if (existing) return;
  await admin.from("notifications").insert({
    user_id: userId,
    type: "comment",
    title: "のりから返信が届きました",
    link_url: "/notices",
    is_read: false,
  });
}

export async function skipDailyFeedback(input: {
  userId: string;
  date: string;
}): Promise<DailyFbResult> {
  const adminInfo = await requireAdmin();
  return upsert(input.userId, input.date, null, "skipped", adminInfo.id);
}
