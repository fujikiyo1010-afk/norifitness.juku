"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveShipmentAddressResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveShipmentAddress(input: {
  postalCode: string;
  addressLine: string;
  building: string;
  recipientName: string;
}): Promise<SaveShipmentAddressResult> {
  const postalCode = input.postalCode.trim();
  const addressLine = input.addressLine.trim();
  const building = input.building.trim();
  const recipientName = input.recipientName.trim();

  if (postalCode.length === 0) return { ok: false, error: "郵便番号を入力してください" };
  if (addressLine.length === 0) return { ok: false, error: "住所を入力してください" };
  if (recipientName.length === 0) return { ok: false, error: "受取人氏名を入力してください" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  // shipments は unique(user_id) のため upsert (再入力にも対応)
  const { error } = await supabase
    .from("shipments")
    .upsert(
      {
        user_id: user.id,
        postal_code: postalCode,
        address_line: addressLine,
        // building は専用カラムが無いため address_line に含めるか、 別途検討
        // 当面は address_line 末尾に「 / 建物名」として連結
        recipient_name: recipientName,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("shipments upsert failed:", error);
    return { ok: false, error: "発送先の登録に失敗しました" };
  }

  // 建物名がある場合は address_line に追記 (簡易対応、 専用カラムは Phase 4 検討)
  if (building.length > 0) {
    await supabase
      .from("shipments")
      .update({ address_line: `${addressLine} ${building}` })
      .eq("user_id", user.id);
  }

  revalidatePath("/");
  return { ok: true };
}
