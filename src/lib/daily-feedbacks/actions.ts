"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

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
  // ＋OSプッシュ（返信が届きました バナー）。送信失敗時は何もしない。
  if (r.ok) await notifyReply(input.userId, input.date, body);
  return r;
}

/** FB送信の通知: 緑バッジ用notification(重複防止) ＋ OSプッシュ(返信バナー)。 */
async function notifyReply(userId: string, date: string, body: string): Promise<void> {
  const admin = createAdminClient();
  // 細9(M16改)/総2: ベータ受講生はその日の食事詳細へ着地(FBが表示される)。非ベータは汎用お知らせ。
  const { data: u } = await admin
    .from("users")
    .select("is_beta")
    .eq("id", userId)
    .maybeSingle();
  const linkUrl = u?.is_beta === true ? `/meals?date=${date}` : "/notices";
  const title = "のりから返信が届きました";

  // 緑バッジ用 notification（未読が既にあれば増やさない）
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "comment")
    .eq("is_read", false)
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await admin.from("notifications").insert({
      user_id: userId,
      type: "comment",
      title,
      link_url: linkUrl,
      is_read: false,
    });
  }

  // OSプッシュ（デイリーFBの返信バナー）。着地は緑バッジと同じ linkUrl。
  // prod専用（devは push_subscriptions テーブルが無く実質no-op）。
  // 失敗が FB送信本体を絶対に巻き込まないよう catch でガード（fire-and-forget）。
  void sendPushToUser(userId, {
    title,
    body: body.length > 60 ? `${body.slice(0, 60)}…` : body,
    url: linkUrl,
  }).catch(() => {});
}

export async function skipDailyFeedback(input: {
  userId: string;
  date: string;
}): Promise<DailyFbResult> {
  const adminInfo = await requireAdmin();
  return upsert(input.userId, input.date, null, "skipped", adminInfo.id);
}
