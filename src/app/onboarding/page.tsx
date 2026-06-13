import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 注: shipments 行の有無による「2 回目以降スキップ」判定は廃止。
  //     理由: Server Action 完了で page.tsx が再実行される性質上、 Step 6 完了直後にも
  //     誤発火して Step 7/8 を飛ばし、 受講生がオンボ完了感を得られないバグになる。
  //     初回オンボへの誘導は /invite acceptInvitation 側で実施済み (新規ユーザーは確実に
  //     /onboarding 着地)。 既存ユーザーが手動で /onboarding を踏んだ場合は紹介画面が
  //     再表示されるだけで無害。

  // ニックネーム廃止 = users.name (or auth metadata の name) を受取人氏名のデフォルトに使う
  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const defaultRecipientName =
    profile?.name ?? (user.user_metadata?.name as string | undefined) ?? "";

  return <OnboardingClient defaultRecipientName={defaultRecipientName} />;
}
