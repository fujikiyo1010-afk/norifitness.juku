"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvitation } from "./actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export function InviteSendForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await sendInvitation({ email, name });
      if (result.ok) {
        setSuccess(`✅ ${result.email} に招待メールを送信しました`);
        setEmail("");
        setName("");
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  const canSubmit =
    email.length > 0 && email.includes("@") && name.trim().length > 0 && !pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="inv-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            氏名
          </label>
          <input
            id="inv-name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder="田中 太郎"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="inv-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            メールアドレス
          </label>
          <input
            id="inv-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            placeholder="student@example.com"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-100">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full sm:w-auto rounded-md bg-zinc-900 dark:bg-zinc-50 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          <>
            <LoadingSpinner /> 送信中…
          </>
        ) : (
          "招待メールを送信"
        )}
      </button>
    </form>
  );
}
