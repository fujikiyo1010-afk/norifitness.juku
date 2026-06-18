"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/account/actions";

/**
 * パスワード変更フォーム (2026-06-17 線① 新設)
 *
 * - 現在パスワード (検証用)
 * - 新パスワード (8 文字以上)
 * - 新パスワード (確認)
 *
 * 成功 → /account に戻る + alert
 * 失敗 → エラー表示
 */
export function PasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const newPwValid = newPassword.length >= 8;
  const confirmMatches = newPassword === confirmPassword;
  const ready =
    currentPassword.length > 0 && newPwValid && confirmMatches && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const res = await updatePassword(email, currentPassword, newPassword);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      alert("パスワードを変更しました");
      router.push("/account");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
      <div>
        <label
          htmlFor="current"
          className="block text-[12px] font-bold text-zinc-700 mb-1.5"
        >
          現在のパスワード <span className="text-rose-600">*</span>
        </label>
        <input
          id="current"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3 text-[14px] text-[#2b2620] outline-none focus:border-[#4a875b]"
        />
      </div>

      <div>
        <label
          htmlFor="new"
          className="block text-[12px] font-bold text-zinc-700 mb-1.5"
        >
          新しいパスワード <span className="text-rose-600">*</span>
        </label>
        <input
          id="new"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3 text-[14px] text-[#2b2620] outline-none focus:border-[#4a875b]"
        />
        <p className="text-[10px] text-[#a59b8c] mt-1">
          {newPassword.length === 0
            ? "8 文字以上"
            : newPwValid
              ? `✓ ${newPassword.length} 文字`
              : `${newPassword.length} / 8 文字`}
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="block text-[12px] font-bold text-zinc-700 mb-1.5"
        >
          新しいパスワード (確認) <span className="text-rose-600">*</span>
        </label>
        <input
          id="confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3 text-[14px] text-[#2b2620] outline-none focus:border-[#4a875b]"
        />
        {confirmPassword.length > 0 && !confirmMatches ? (
          <p className="text-[10px] text-rose-600 mt-1">
            新しいパスワードと一致しません
          </p>
        ) : null}
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
          disabled={!ready}
          className="flex-1 bg-[#4a875b] text-white rounded-2xl px-4 py-3 text-[13px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-50"
        >
          {pending ? "変更中..." : "変更する"}
        </button>
      </div>
    </form>
  );
}
