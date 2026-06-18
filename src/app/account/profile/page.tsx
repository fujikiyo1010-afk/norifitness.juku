import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

/**
 * プロフィール編集画面 ・ /account/profile (2026-06-17 線① 新設)
 *
 * 線① 編集対象 = 氏名のみ。 メール変更 / パスワード変更 / アバター画像 等は線② で追加。
 */
export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  const name = (profile?.name as string | null) ?? "";
  const email = (profile?.email as string | null) ?? user.email ?? "";

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="プロフィール編集" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-6 space-y-5">
          <p className="text-[12px] text-zinc-600 leading-[1.6]">
            のり氏や事務局から呼びかける時に使う名前です。 漢字 ・ ひらがな ・ ニックネーム どれでも OK。
          </p>

          <ProfileForm initialName={name} email={email} />
        </div>
      </div>
    </main>
  );
}
