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
