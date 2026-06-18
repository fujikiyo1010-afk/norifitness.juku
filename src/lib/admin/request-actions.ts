"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

const PREVIEW_MAX = 80;
function shortPreview(text: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= PREVIEW_MAX ? t : t.slice(0, PREVIEW_MAX - 1) + "…";
}

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
    .select("id, user_id")
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

  // 受講生に push 通知 (= リクエストへの対応完了)
  const targetUserId = (data as { user_id?: string } | null)?.user_id;
  if (targetUserId) {
    const title =
      type === "carte"
        ? "カルテ更新リクエストへの返信"
        : "メニュー変更リクエストへの返信";
    const url = type === "carte" ? "/workout/carte" : "/workout";
    void sendPushToUser(targetUserId, {
      title,
      body: shortPreview(text),
      url,
      tag: `request-handled-${type}`,
    }).catch((e) => console.error("[push] request handled failed", e));
  }

  return { ok: true };
}
