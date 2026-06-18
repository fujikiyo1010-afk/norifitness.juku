"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEmailChange } from "@/lib/account/actions";

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // オートフィル対策: form の生 value を優先
    const form = e.currentTarget;
    const newEmailEl = form.elements.namedItem(
      "new_email"
    ) as HTMLInputElement | null;
    const pwEl = form.elements.namedItem(
      "current_password"
    ) as HTMLInputElement | null;
    const newEmailVal = newEmailEl?.value ?? newEmail;
    const pwVal = pwEl?.value ?? currentPassword;

    startTransition(async () => {
      const r = await requestEmailChange(currentEmail, newEmailVal, pwVal);
      if (r.ok) {
        setSuccess(true);
        setNewEmail("");
        setCurrentPassword("");
      } else {
        setError(r.error);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] p-5 space-y-3 text-center">
        <div className="text-[15px] font-bold text-[#34603f]">
          ✓ 変更を申請しました
        </div>
        <p className="text-[12px] text-[#6a6256] leading-relaxed">
          新しいメールアドレスに <b>Supabase からの確認リンク</b> を送信しました。
          <br />
          メールを開いてリンクをクリックすると変更が完了します。
          <br />
          <br />
          旧メールアドレスにも「変更要求があります」 通知メールを送信しました。
          <br />
          心当たりがない場合は、 リンクをクリックせずにサポートまでご連絡ください。
        </p>
        <button
          type="button"
          onClick={() => router.push("/account")}
          className="rounded-full bg-[#4a875b] hover:bg-[#34603f] text-white text-[13px] font-bold px-5 py-2 mt-2"
        >
          設定に戻る
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] p-5 space-y-4"
    >
      <div className="space-y-1">
        <label className="block text-[11px] font-bold text-[#6a6256]">
          現在のメールアドレス
        </label>
        <div className="rounded-md border border-[#e7dcc9] bg-[#f9f5ed] px-3 py-2 text-sm text-[#6a6256] font-mono break-all">
          {currentEmail}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="new_email" className="block text-[11px] font-bold text-[#2b2620]">
          新しいメールアドレス
        </label>
        <input
          id="new_email"
          name="new_email"
          type="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          disabled={pending}
          placeholder="example@gmail.com"
          className="w-full rounded-md border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2 text-sm focus:outline-none focus:border-[#4a875b] disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="current_password"
          className="block text-[11px] font-bold text-[#2b2620]"
        >
          現在のパスワード (= 本人確認)
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2 text-sm focus:outline-none focus:border-[#4a875b] disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#4a875b] hover:bg-[#34603f] text-white text-[13px] font-bold px-6 py-2.5 disabled:bg-[#a59b8c]"
        >
          {pending ? "申請中..." : "変更を申請"}
        </button>
      </div>
    </form>
  );
}
