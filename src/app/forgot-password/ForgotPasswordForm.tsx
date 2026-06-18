"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-4 text-sm space-y-2">
          <p className="text-emerald-900 dark:text-emerald-100 font-medium">
            ✅ メールを送信しました
          </p>
          <p className="text-emerald-800 dark:text-emerald-200 text-xs">
            <span className="font-medium">{email}</span> 宛にパスワード再設定リンクを送信しました。メールボックスをご確認ください。
          </p>
          <p className="text-emerald-700 dark:text-emerald-300 text-xs">
            ※ メールが届かない場合: 迷惑メールフォルダもご確認ください。それでも届かない場合、メールアドレスが登録されていない可能性があります。
          </p>
        </div>
        <Link
          href="/login"
          className="block text-center text-sm text-zinc-700 dark:text-zinc-300 underline"
        >
          ← ログイン画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          ご登録のメールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-[#fffdf8] dark:bg-zinc-950 px-3 py-2 text-sm text-[#2b2620] dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !email.includes("@")}
        className="w-full rounded-md bg-zinc-900 dark:bg-[#f3ecda] px-4 py-2.5 text-sm font-medium text-white dark:text-[#2b2620] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "送信中…" : "再設定メールを送信"}
      </button>

      <Link
        href="/login"
        className="block text-center text-xs text-zinc-600 dark:text-[#a59b8c] underline"
      >
        ← ログイン画面に戻る
      </Link>
    </form>
  );
}
