import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-static";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 bg-[#f9f5ed]">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#2b2620] dark:text-zinc-50">
            🔑 パスワード再設定
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
            ご登録のメールアドレスに、パスワード再設定のリンクをお送りします。
          </p>
        </header>

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
