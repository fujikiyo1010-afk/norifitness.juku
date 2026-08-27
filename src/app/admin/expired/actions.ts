"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * 満了タブの操作 (C2 2026-08-26)
 * - 特別(grace)を付ける/期日変更: grace_until + grace_scope('full'|'meal')
 * - 特別を外す: 純満了版へ
 * - 通常へ戻す(再契約): service_started_at を今日にリセット + grace解除
 */

export async function setGraceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const until = String(formData.get("until") ?? "");
  const scope = String(formData.get("scope") ?? "full");
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return;
  if (scope !== "full" && scope !== "meal") return;
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ grace_until: until, grace_scope: scope })
    .eq("id", userId);
  revalidatePath("/admin/expired");
}

export async function clearGraceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ grace_until: null, grace_scope: null })
    .eq("id", userId);
  revalidatePath("/admin/expired");
}

export async function restartServiceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({
      service_started_at: jstTodayStr(),
      grace_until: null,
      grace_scope: null,
    })
    .eq("id", userId);
  revalidatePath("/admin/expired");
}
