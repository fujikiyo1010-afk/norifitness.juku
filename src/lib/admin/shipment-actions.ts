"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

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
