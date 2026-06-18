"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateName } from "@/lib/account/actions";

/**
 * プロフィール編集フォーム (2026-06-17 線① 新設)
 *
 * - 氏名 (必須 / 1-40 文字)
 * - メール (read-only 表示 ・ 変更は線②)
 * - 保存後は /account に戻る
 */
export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== initialName.trim();
  const valid = name.trim().length > 0 && name.trim().length <= 40;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateName(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/account");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="name"
          className="block text-[12px] font-bold text-zinc-700 mb-1.5"
        >
          氏名 <span className="text-rose-600">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="name"
          required
          className="w-full bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3 text-[14px] text-[#2b2620] outline-none focus:border-[#4a875b]"
        />
        <p className="text-[10px] text-[#a59b8c] mt-1">
          {name.trim().length} / 40 文字
        </p>
      </div>

      <div>
        <label className="block text-[12px] font-bold text-zinc-700 mb-1.5">
          メールアドレス
        </label>
        <input
          type="email"
          value={email}
          readOnly
          aria-readonly
          className="w-full bg-[#f9f5ed] border border-[#e7dcc9] rounded-xl px-4 py-3 text-[14px] text-[#6a6256] outline-none cursor-not-allowed"
        />
        <p className="text-[10px] text-[#a59b8c] mt-1">
          メールアドレスの変更は準備中です。
        </p>
      </div>

      {error ? (
        <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/account")}
          disabled={pending}
          className="flex-1 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3 text-[13px] font-bold text-zinc-700 hover:bg-[#f0e6d3] transition-colors disabled:opacity-60"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!dirty || !valid || pending}
          className="flex-1 bg-[#4a875b] text-white rounded-2xl px-4 py-3 text-[13px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
      </div>
    </form>
  );
}
