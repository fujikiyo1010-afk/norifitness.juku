"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type RequestType = "carte" | "workout";

type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * リクエストに返信して「対応済」に更新 (即時モデル)
 *
 * 設計原則:
 *   - status は pending → handled の 2 値のみ
 *   - 中間状態 (in_progress / 反映待ち 等) は作らない
 *   - 返信は完了形 (「変更しました」)
 */
export async function replyToRequest(
  type: RequestType,
  requestId: string,
  replyText: string
): Promise<ActionResult> {
  const text = replyText.trim();
  if (!text) {
    return { ok: false, message: "返信内容を入力してください" };
  }
  if (text.length > 2000) {
    return { ok: false, message: "返信は 2000 文字以内で入力してください" };
  }

  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const table = type === "carte" ? "user_carte_request" : "user_workout_request";
  const now = new Date().toISOString();

  const { error, data } = await supabase
    .from(table)
    .update({
      admin_reply_text: text,
      replied_at: now,
      status: "handled",
      handled_at: now,
      handled_by: admin.id,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: `送信エラー: ${error.message}` };
  }
  if (!data) {
    return {
      ok: false,
      message: "対応済または存在しないリクエストです",
    };
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  // 受講生ハブからもアクセスされるので layout 単位で revalidate
  revalidatePath("/admin/users", "layout");
  return { ok: true };
}
