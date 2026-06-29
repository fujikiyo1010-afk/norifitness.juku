"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateAddressResult = { ok: true } | { ok: false; error: string };

/**
 * プロフィールからの発送先住所 変更 (層2 ・ 2026-06-29)
 *
 * - 発送準備中 (status=pending) のみ変更可。発送済み/キャンセルは拒否。
 * - 同じ shipments 行を update するので、管理者の発送画面に即反映される。
 * - status は触らない (= 発送済みを誤って戻さない)。
 */
export async function updateMyShipmentAddress(input: {
  postalCode: string;
  addressLine: string;
  recipientName: string;
}): Promise<UpdateAddressResult> {
  const postalCode = input.postalCode.trim();
  const addressLine = input.addressLine.trim();
  const recipientName = input.recipientName.trim();

  if (postalCode.length === 0)
    return { ok: false, error: "郵便番号を入力してください" };
  if (addressLine.length === 0)
    return { ok: false, error: "住所を入力してください" };
  if (recipientName.length === 0)
    return { ok: false, error: "受取人氏名を入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data: shipment } = await supabase
    .from("shipments")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!shipment) return { ok: false, error: "発送情報が見つかりません" };
  if (shipment.status !== "pending") {
    return { ok: false, error: "発送済みのため住所は変更できません" };
  }

  const { error } = await supabase
    .from("shipments")
    .update({
      postal_code: postalCode,
      address_line: addressLine,
      recipient_name: recipientName,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("updateMyShipmentAddress failed:", error);
    return { ok: false, error: "住所の更新に失敗しました" };
  }

  revalidatePath("/profile");
  revalidatePath("/admin/shipments");
  return { ok: true };
}
