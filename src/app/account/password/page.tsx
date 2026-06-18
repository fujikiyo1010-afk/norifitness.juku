import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

/**
 * パスワード変更 (/account/password) ・ 2026-06-17 線① 新設
 *
 * ログイン中の受講生が新パスワードに変更する画面。
 * 現在パスワードで一度認証 → 成功時に `supabase.auth.updateUser({ password })` で更新。
 *
 * 「忘れた」 経路は /forgot-password → /reset-password で別途完備。
 */
export default async function PasswordChangePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/password");

  return (
    <main className="flex flex-1 flex-col bg-[#ebdfc6] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <MemberHeader title="パスワード変更" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-6 space-y-5">
          <p className="text-[12px] text-zinc-600 leading-[1.6]">
            現在のパスワードを入力した上で、 新しいパスワードを設定してください。 8 文字以上 ・ 半角英数字推奨。
          </p>

          <PasswordForm email={user.email ?? ""} />
        </div>
      </div>
    </main>
  );
}
