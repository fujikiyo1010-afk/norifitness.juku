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
  return upsert(input.userId, input.date, body, "sent", adminInfo.id);
}

export async function skipDailyFeedback(input: {
  userId: string;
  date: string;
}): Promise<DailyFbResult> {
  const adminInfo = await requireAdmin();
  return upsert(input.userId, input.date, null, "skipped", adminInfo.id);
}
