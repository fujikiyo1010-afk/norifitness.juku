import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminInfo } from "@/lib/auth/admin";
import { signOut } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware で未ログインは弾かれているので user は基本存在する想定
  let displayName = user?.email ?? "受講生";
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("name, nickname")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      displayName = profile.nickname || profile.name;
    }
  }

  const admin = await getAdminInfo();

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            🎓 筋肉塾
          </h1>
          <p className="text-base text-zinc-700 dark:text-zinc-300">
            {displayName} さん、ようこそ
            {admin && (
              <span className="ml-2 inline-block rounded-full bg-violet-100 dark:bg-violet-900 px-2 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-100 align-middle">
                {admin.role}
              </span>
            )}
          </p>
        </header>

        {admin && (
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 p-4 text-sm">
            <h2 className="font-semibold mb-2 text-violet-900 dark:text-violet-100">
              🔧 管理機能
            </h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/admin/invitations"
                  className="text-violet-700 dark:text-violet-300 underline hover:text-violet-900 dark:hover:text-violet-100"
                >
                  → 受講生招待
                </Link>
              </li>
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-sm">
          <h2 className="font-semibold mb-3 text-zinc-900 dark:text-zinc-50">
            🚧 開発状況(フェーズ1)
          </h2>
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>✅ Next.js 16 + Supabase + Tailwind</li>
            <li>✅ DB スキーマ適用済み</li>
            <li>✅ 認証フロー(招待 → パス設定 → ログイン)</li>
            <li>✅ 管理画面: 受講生招待</li>
            <li>⏳ マイページ詳細実装</li>
            <li>⏳ コンテンツ閲覧</li>
            <li>⏳ デプロイ準備</li>
          </ul>
        </div>

        <form action={signOut} className="flex justify-center">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            ログアウト
          </button>
        </form>

        <p className="text-xs text-center text-zinc-500">
          公開予定: 2026年8月末
        </p>
      </div>
    </main>
  );
}
