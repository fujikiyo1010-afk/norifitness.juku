import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#2b2620] dark:text-zinc-50">
            🔑 新しいパスワードを設定
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
            メールのリンクから来ました。新しいパスワードを入力してください。
          </p>
        </header>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
