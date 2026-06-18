"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSignupRequest } from "./actions";

export function RequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isValid =
    name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValid || isPending) return;

    startTransition(async () => {
      const result = await submitSignupRequest({
        name: name.trim(),
        email: email.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/request?submitted=1");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="name"
          className="text-[10.5px] font-semibold text-zinc-600 pl-0.5"
        >
          氏名 <span className="text-[#c44] text-[9px] font-bold ml-0.5">必須</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="鈴木 太郎"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="border border-zinc-300 rounded-[10px] px-3 py-2.5 text-[13px] bg-[#fffdf8] text-[#2b2620] outline-none focus:border-[#4a875b] focus:ring-2 focus:ring-[#4a875b]/30"
          required
        />
        <p className="text-[10px] text-[#6a6256] pl-0.5">
          <strong>LINE と同じ名前を入れてください</strong>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-[10.5px] font-semibold text-zinc-600 pl-0.5"
        >
          メールアドレス{" "}
          <span className="text-[#c44] text-[9px] font-bold ml-0.5">必須</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="border border-zinc-300 rounded-[10px] px-3 py-2.5 text-[13px] bg-[#fffdf8] text-[#2b2620] outline-none focus:border-[#4a875b] focus:ring-2 focus:ring-[#4a875b]/30"
          required
        />
        <p className="text-[10px] text-[#6a6256] pl-0.5">
          アカウント有効化リンクをお送りします
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || isPending}
        className="mt-1.5 w-full bg-[#4a875b] hover:bg-[#34603f] disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl py-3 text-[13px] font-bold shadow-md shadow-[#4a875b]/25 transition-colors"
      >
        {isPending ? "送信中..." : "申請する"}
      </button>
    </form>
  );
}
