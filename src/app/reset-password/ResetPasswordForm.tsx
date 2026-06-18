"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SessionState = "loading" | "ready" | "no_session";

/**
 * パスワード再設定フォーム。
 *
 * Supabase Auth の reset email リンクをクリックすると、URL の hash に
 * access_token が乗ってこのページに着地する。@supabase/ssr のクライアントは
 * detectSessionInUrl=true がデフォルトなので、ロード時に自動でセッション確立。
 *
 * onAuthStateChange の "PASSWORD_RECOVERY" イベント、または getSession() の結果で
 * セッションが取れたら form を表示。タイムアウトしたら「リンク切れ」エラー。
 */
export function ResetPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // セッション確認(マウント時 + onAuthStateChange + タイムアウト)
  useEffect(() => {
    let mounted = true;

    // 既に session があれば ready に
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) setSessionState("ready");
    });

    // PASSWORD_RECOVERY イベントを監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionState("ready");
      }
    });

    // タイムアウト: 4 秒待ってもセッションが来なければ「リンク切れ」扱い
    const timer = setTimeout(async () => {
      if (!mounted) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) setSessionState("no_session");
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("パスワードは 8 文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setError("確認用のパスワードが一致しません");
      return;
    }

    startTransition(async () => {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setSuccess("パスワードを更新しました。ホームに移動します…");
      setTimeout(() => router.push("/"), 1500);
    });
  }

  if (sessionState === "loading") {
    return (
      <p className="text-sm text-[#6a6256] text-center py-8">
        リンクを確認中です…
      </p>
    );
  }

  if (sessionState === "no_session") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 text-sm space-y-2">
          <p className="text-amber-900 dark:text-amber-100 font-medium">
            ⚠️ リンクが無効です
          </p>
          <p className="text-amber-800 dark:text-amber-200 text-xs">
            リンクの有効期限が切れているか、無効なリンクです。再度パスワード再設定をやり直してください。
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-[#2b2620] dark:text-zinc-50 underline"
        >
          → パスワード再設定をやり直す
        </Link>
      </div>
    );
  }

  // sessionState === "ready"
  const passwordsMismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit =
    password.length >= 8 && confirm.length >= 8 && password === confirm && !pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          新しいパスワード(8 文字以上)
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-[#fffdf8] dark:bg-zinc-950 px-3 py-2 text-sm text-[#2b2620] dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
        />
        {tooShort && (
          <p className="text-xs text-amber-600">
            あと {8 - password.length} 文字必要です
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="confirm"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          新しいパスワード(確認)
        </label>
        <input
          id="confirm"
          name="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-[#fffdf8] dark:bg-zinc-950 px-3 py-2 text-sm text-[#2b2620] dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50"
        />
        {passwordsMismatch && (
          <p className="text-xs text-amber-600">パスワードが一致しません</p>
        )}
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
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-100">
          ✅ {success}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-zinc-900 dark:bg-[#ebdfc6] px-4 py-2.5 text-sm font-medium text-white dark:text-[#2b2620] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "更新中…" : "新しいパスワードに更新"}
      </button>
    </form>
  );
}
