"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShipmentShippedEmail } from "@/lib/email/shipment-shipped";
import { sendPushToUser } from "@/lib/push/send";

type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * 発送済にマーク (歓迎ギフト発送完了)
 */
export async function markAsShipped(shipmentId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error, data } = await supabase
    .from("shipments")
    .update({
      status: "shipped",
      shipped_at: now,
      shipped_by: admin.id,
    })
    .eq("id", shipmentId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: `エラー: ${error.message}` };
  if (!data) return { ok: false, message: "対象が見つからないか既に発送済です" };

  revalidatePath("/admin/shipments");
  revalidatePath("/admin");

  // 受講生に Mail + Push 通知 (= B-5、 失敗してもメイン処理は成功扱い)
  // shipmentId から user_id 逆引きは email module / push 側でやる
  const { data: shipmentRow } = await supabase
    .from("shipments")
    .select("user_id")
    .eq("id", shipmentId)
    .maybeSingle();
  const targetUserId = (shipmentRow as { user_id?: string } | null)?.user_id;
  if (targetUserId) {
    void sendShipmentShippedEmail(shipmentId).catch((e) =>
      console.error("[email] shipment shipped failed", e)
    );
    void sendPushToUser(targetUserId, {
      title: "プロテインを発送しました",
      body: "歓迎ギフトを本日発送しました。 1〜3 日以内にお届け予定です",
      url: "/",
      tag: `shipment-${shipmentId}`,
    }).catch((e) => console.error("[push] shipment shipped failed", e));
  }

  return { ok: true };
}

/**
 * 発送済 → 未発送 に戻す (誤操作の取消)
 */
export async function undoShipped(shipmentId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error, data } = await supabase
    .from("shipments")
    .update({
      status: "pending",
      shipped_at: null,
      shipped_by: null,
    })
    .eq("id", shipmentId)
    .eq("status", "shipped")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: `エラー: ${error.message}` };
  if (!data) return { ok: false, message: "対象が見つかりません" };

  revalidatePath("/admin/shipments");
  revalidatePath("/admin");
  return { ok: true };
}
