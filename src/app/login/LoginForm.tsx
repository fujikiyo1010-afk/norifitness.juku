"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // ブラウザのオートフィル対策: React state より input の生 value を優先
    const form = e.currentTarget;
    const emailEl = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordEl = form.elements.namedItem("password") as HTMLInputElement | null;
    const emailVal = emailEl?.value ?? email;
    const passwordVal = passwordEl?.value ?? password;

    if (!emailVal || !passwordVal) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    startTransition(async () => {
      const result = await signIn(emailVal, passwordVal, next);
      // 成功時は redirect が走るのでここには来ない
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  // 押下のみガード (= オートフィルで state 空でもログインできるよう)
  const canSubmit = !pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          メールアドレス
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

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-[#fffdf8] dark:bg-zinc-950 px-3 py-2 text-sm text-[#2b2620] dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-[#a59b8c]">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          disabled={pending}
        />
        パスワードを表示する
      </label>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-zinc-900 dark:bg-[#ebdfc6] px-4 py-2.5 text-sm font-medium text-white dark:text-[#2b2620] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "ログイン中…" : "ログイン"}
      </button>

      <Link
        href="/forgot-password"
        className="block text-center text-xs text-zinc-600 dark:text-[#a59b8c] underline"
      >
        パスワードを忘れた方 →
      </Link>
    </form>
  );
}
