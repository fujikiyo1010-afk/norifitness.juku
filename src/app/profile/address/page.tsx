import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { AddressForm } from "./AddressForm";

export const dynamic = "force-dynamic";

/**
 * 発送先住所 変更ページ (/profile/address ・ 層2 2026-06-29)
 * - 発送準備中 (pending) のみ到達可。発送済み/未登録は /profile に戻す。
 */
export default async function ProfileAddressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/address");

  const { data: shipment } = await supabase
    .from("shipments")
    .select("postal_code, address_line, recipient_name, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // 発送済み or 未登録なら編集不可 → プロフィールへ
  if (!shipment || shipment.status !== "pending") {
    redirect("/profile");
  }

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="発送先の変更" fallbackHref="/profile" />
        <div className="px-4 py-4">
          <AddressForm
            initialPostalCode={(shipment.postal_code as string | null) ?? ""}
            initialAddressLine={(shipment.address_line as string | null) ?? ""}
            initialRecipientName={(shipment.recipient_name as string | null) ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
