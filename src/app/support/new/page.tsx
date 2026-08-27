import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isSupportUser } from "@/lib/auth/support-gate";
import { SupportForm } from "./SupportForm";

export const dynamic = "force-dynamic";

/**
 * お問い合わせ フォーム ・ /support/new (2026-08-27 新設)
 *
 * 送信すると、その件のスレッドが1本できて /support/[id] に着地する。
 * 設計元: public/mock/support-flow.html 画面3
 */
export default async function SupportNewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/support/new");
  if (!(await isSupportUser())) redirect("/");

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="お問い合わせフォーム" fallbackHref="/support" />
        <SupportForm userId={user.id} />
      </div>
    </main>
  );
}
