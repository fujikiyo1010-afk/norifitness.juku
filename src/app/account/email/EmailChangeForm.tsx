"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyEmailChangeRequest } from "./_actions";

/**
 * メールアドレス変更フォーム (2026-06-18 #8 ・Client 全面実装)
 *
 * Auth 操作 (= signInWithPassword + updateUser) は Server Action では cookie 同期で問題が出るため、
 * Browser Supabase client で直接実行する。
 * 旧メール宛通知だけ Server Action 経由 (= 副作用、 メール送信のみ)。
 */
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
    const newEmailVal = (newEmailEl?.value ?? newEmail).trim().toLowerCase();
    const pwVal = pwEl?.value ?? currentPassword;

    if (!newEmailVal) {
      setError("新しいメールアドレスを入力してください");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailVal)) {
      setError("メールアドレスの形式が正しくありません");
      return;
    }
    if (newEmailVal === currentEmail.toLowerCase()) {
      setError("現在と同じメールアドレスです");
      return;
    }
    if (!pwVal) {
      setError("現在のパスワードを入力してください");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      // 1) 本人確認 (= browser context、 cookie 自動同期)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail.toLowerCase(),
        password: pwVal,
      });
      if (signInError) {
        setError("現在のパスワードが正しくありません");
        return;
      }

      // 2) Supabase にメール変更申請 (= 新メールに確認リンク送信)
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmailVal,
      });
      if (updateError) {
        const msg = updateError.message ?? "";
        setError(
          msg.toLowerCase().includes("already") ||
            msg.toLowerCase().includes("registered")
            ? "このメールアドレスは既に使われています"
            : msg
        );
        return;
      }

      // 3) 旧メール宛通知 (= Server Action ・メール送信副作用のみ)
      await notifyEmailChangeRequest(newEmailVal).catch(() => {
        // 通知失敗してもメアド変更自体は成功扱い (= ログに記録だけ)
      });

      setSuccess(true);
      setNewEmail("");
      setCurrentPassword("");
    });
  }

  if (success) {
    return (
      <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] p-5 space-y-3 text-center">
        <div className="text-[15px] font-bold text-[#34603f]">
          ✓ 変更を申請しました
        </div>
        <p className="text-[12px] text-[#6a6256] leading-relaxed">
          新しいメールアドレスに <b>確認リンク</b> を送信しました。
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
          className="rounded-full btn3d text-white text-[13px] font-bold px-5 py-2 mt-2"
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
          className="rounded-full btn3d text-white text-[13px] font-bold px-6 py-2.5"
        >
          {pending ? "申請中..." : "変更を申請"}
        </button>
      </div>
    </form>
  );
}
