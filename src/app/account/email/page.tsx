import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { EmailChangeForm } from "./EmailChangeForm";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・メールアドレス変更 (/account/email) ・ 2026-06-18 線① #8
 *
 * - 現在メール表示 (= read-only)
 * - 新メール入力 + 現在 PW で本人確認
 * - 申請 → 旧メールに通知 + 新メールに Supabase 確認リンク
 * - リンククリック完了で auth.users.email 更新 + trigger で public.users.email 同期
 */
export default async function EmailChangePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/email");

  const currentEmail = user.email ?? "";

  return (
    <>
      <MemberHeader title="メールアドレス変更" fallbackHref="/account" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] p-5 space-y-5">
          <p className="text-[12px] text-[#6a6256] leading-relaxed">
            メールアドレスを変更できます。 新メールに確認リンクを送信、
            リンクをクリックすると変更が完了します。
            <br />
            <span className="text-[#d9743f]">
              ※ 確認リンクをクリックするまでは現在のメールでログインできます。
            </span>
          </p>

          <EmailChangeForm currentEmail={currentEmail} />
        </div>
      </main>
    </>
  );
}
