"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 管理ホーム「チャット未返信」警報の手動「完了にする」(案A)。
 * 返信せずに返信不要として片付ける。押した時刻(acked_at=now)を記録し、
 * alerts 側で「受講生の最終発言 <= acked_at」なら警報を抑制する。
 * 受講生が新しく発言すると発言時刻 > acked_at となり、警報は自動で再表示される。
 * admin_chat_acks は user_id が PK＝1受講生1行、upsert で最新時刻に上書き。
 */
export type AckResult = { ok: true } | { ok: false; message: string };

export async function ackChatUnreplied(input: {
  userId: string;
}): Promise<AckResult> {
  const adminInfo = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("admin_chat_acks").upsert(
    {
      user_id: input.userId,
      acked_at: new Date().toISOString(),
      acked_by: adminInfo.id,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
