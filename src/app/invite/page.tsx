import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string }>;

export default async function InvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InviteError title="無効なリンク" message="招待トークンが見つかりません。メール内のリンクから再度アクセスしてください。" />;
  }

  const supabase = createAdminClient();
  const { data: inv, error } = await supabase
    .from("invitations")
    .select("id, email, name, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !inv) {
    return <InviteError title="無効なリンク" message="このリンクは存在しないか、無効です。サポート LINE までご連絡ください。" />;
  }

  if (inv.accepted_at) {
    return (
      <InviteError
        title="このリンクは使用済みです"
        message="既にパスワードの設定が完了しています。ログイン画面からお進みください。"
        showLoginLink
      />
    );
  }

  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return (
      <InviteError
        title="リンクの有効期限が切れています"
        message="招待リンクの有効期限が過ぎています。サポート LINE までご連絡いただき、再発行をご依頼ください。"
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#2b2620] dark:text-zinc-50">
            🎓 のりfitness 筋肉塾
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
            初回ログインのパスワードを設定してください
          </p>
        </header>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#ebdfc6] dark:bg-zinc-900 p-4 text-sm space-y-1">
          <div className="text-[#6a6256] dark:text-[#a59b8c]">招待先</div>
          <div className="font-medium text-[#2b2620] dark:text-zinc-50">{inv.name}</div>
          <div className="text-zinc-600 dark:text-[#a59b8c] break-all">{inv.email}</div>
        </div>

        <InviteForm token={token} />

        <p className="text-xs text-center text-[#6a6256]">
          パスワードは 8 文字以上で設定してください
        </p>
      </div>
    </main>
  );
}

function InviteError({
  title,
  message,
  showLoginLink = false,
}: {
  title: string;
  message: string;
  showLoginLink?: boolean;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold text-[#2b2620] dark:text-zinc-50">⚠️ {title}</h1>
        <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">{message}</p>
        {showLoginLink && (
          <a
            href="/login"
            className="inline-block rounded-md bg-zinc-900 dark:bg-[#ebdfc6] px-4 py-2 text-sm font-medium text-white dark:text-[#2b2620]"
          >
            ログイン画面へ
          </a>
        )}
      </div>
    </main>
  );
}
