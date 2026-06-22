"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdmin } from "./actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export function AddAdminForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await addAdmin({ email, name, password });
      if (result.ok) {
        const isReactivated = result.meta?.reactivated === true;
        const isNewAuth = result.meta?.isNewAuth === true;
        if (isReactivated) {
          setSuccess(`✅ ${email} を再有効化しました`);
        } else if (isNewAuth) {
          setSuccess(
            `✅ ${email} を管理者として登録しました。 仮 PW をご本人にお伝えください`
          );
        } else {
          setSuccess(
            `✅ ${email} (= 既存ユーザー) を管理者に昇格しました`
          );
        }
        setEmail("");
        setName("");
        setPassword("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const canSubmit =
    email.length > 0 &&
    email.includes("@") &&
    name.trim().length > 0 &&
    password.length >= 8 &&
    !pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label htmlFor="adm-name" className="block text-sm font-medium text-zinc-700">
            氏名
          </label>
          <input
            id="adm-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder="のり氏"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="adm-email" className="block text-sm font-medium text-zinc-700">
            メールアドレス
          </label>
          <input
            id="adm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            placeholder="nori@example.com"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="adm-password" className="block text-sm font-medium text-zinc-700">
            仮パスワード (= 8 文字以上)
          </label>
          <input
            id="adm-password"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            placeholder="Initial2026!"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full sm:w-auto rounded-md bg-[#00897b] hover:bg-[#00695c] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <LoadingSpinner /> 登録中…
          </>
        ) : (
          "管理者を追加"
        )}
      </button>

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        ※ 既に受講生登録済のメアドを入力すると、 そのユーザーが「管理者に昇格」 されます (= 新規 PW は不要 / 既存 PW でログイン可)。
        <br />
        ※ 新規メアドの場合のみ 仮 PW で auth ユーザー作成 → 本人がログイン後 PW 変更してください。
      </p>
    </form>
  );
}
