import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#2b2620] dark:text-zinc-50">
            🎓 のりfitness 筋肉塾
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
            受講生専用 学習プラットフォーム
          </p>
        </header>

        <LoginForm next={next ?? null} />

        <p className="text-xs text-center text-[#6a6256]">
          ログインできない場合は、サポート LINE までご連絡ください
        </p>
      </div>
    </main>
  );
}
