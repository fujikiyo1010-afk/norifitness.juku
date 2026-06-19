"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { acceptInvitation } from "./actions";
import { detectBrowserEnv, type BrowserEnv } from "@/lib/browser-check";

export function InviteForm({ token }: { token: string }) {
  const [env, setEnv] = useState<BrowserEnv | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    setEnv(detectBrowserEnv());
    setCurrentUrl(window.location.href);
  }, []);

  // 判定中 (= SSR / hydration 直後) は空白
  if (env === null) return null;

  // PWA 化不可ブラウザ → 切替案内 (= PW 設定前に止める)
  if (env === "ios-other" || env === "android-other" || env === "desktop") {
    return <InviteBrowserSwitchGuide env={env} currentUrl={currentUrl} />;
  }

  return <InvitePasswordForm token={token} />;
}

function InvitePasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const passwordsMismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit =
    password.length >= 8 && confirm.length >= 8 && password === confirm && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("パスワードは 8 文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setError("確認用のパスワードが一致しません");
      return;
    }

    startTransition(async () => {
      const result = await acceptInvitation(token, password);
      // 成功時は redirect が走るのでここには来ない
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          パスワード（8 文字以上）
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
          <p className="text-xs text-amber-600">あと {8 - password.length} 文字必要です</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          パスワード（確認）
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

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-zinc-900 dark:bg-[#f9f5ed] px-4 py-2.5 text-sm font-medium text-white dark:text-[#2b2620] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "設定中…" : "パスワードを設定してログイン"}
      </button>
    </form>
  );
}

// =====================================================================
// PWA 化不可ブラウザ → 切替案内 (iOS 他ブラウザ / Android 他ブラウザ / PC)
// =====================================================================

function InviteBrowserSwitchGuide({
  env,
  currentUrl,
}: {
  env: BrowserEnv;
  currentUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const config =
    env === "ios-other"
      ? {
          title: "Safari で\n開いてください",
          lead: (
            <>
              iPhone のホーム画面追加 (= アプリ化) は
              <br />
              <b className="text-[#004d40] font-bold">Safari でのみできます</b>
            </>
          ),
          appName: "Safari",
          appHint: "青い羅針盤アイコン",
        }
      : env === "android-other"
        ? {
            title: "Chrome で\n開いてください",
            lead: (
              <>
                Android のホーム画面追加 (= アプリ化) は
                <br />
                <b className="text-[#004d40] font-bold">Chrome がおすすめです</b>
              </>
            ),
            appName: "Chrome",
            appHint: "赤緑黄青の丸アイコン",
          }
        : {
            title: "スマホで\n開いてください",
            lead: (
              <>
                筋肉塾はスマホでお使いいただくサービスです。
                <br />
                <b className="text-[#004d40] font-bold">
                  iPhone Safari か Android Chrome
                </b>
                でお進みください
              </>
            ),
            appName: "スマホのブラウザ",
            appHint: "iPhone Safari か Android Chrome",
          };

  async function handleCopy() {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <div className="w-[100px] h-[100px] rounded-full shadow-lg shadow-[#4a875b]/20 mb-4 overflow-hidden bg-[#fffdf8]">
          <div className="w-full h-full relative scale-[1.2]">
            <Image
              src="/images/nori-character.png"
              alt="のりキャラクター"
              fill
              sizes="100px"
              className="object-cover"
              priority
            />
          </div>
        </div>
        <h2 className="text-[18px] font-bold text-[#004d40] leading-snug mb-2 whitespace-pre-line">
          {config.title}
        </h2>
        <p className="text-xs text-zinc-600 leading-relaxed">{config.lead}</p>
      </div>

      <div className="bg-[#fffdf8] border border-[#4a875b]/15 rounded-xl px-4 py-4 text-left">
        <div className="text-[11px] font-bold text-[#004d40] tracking-widest mb-3">
          開き直す手順
        </div>
        <ol className="space-y-3 text-[12.5px] text-[#2b2620] leading-relaxed">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
              1
            </span>
            <span>
              下の <b>URL をコピー</b> ボタンをタップ
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
              2
            </span>
            <span>
              ホーム画面の <b>{config.appName}</b> ({config.appHint}) を起動
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
              3
            </span>
            <span>
              URL バーを長押し → <b>「ペースト」</b> → 開く
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 w-full bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl py-3 text-[12.5px] font-bold shadow-md shadow-[#4a875b]/25 transition-colors"
        >
          {copied ? "✓ URL をコピーしました" : "URL をコピー"}
        </button>

        <p className="mt-3 text-[10px] text-[#6a6256] break-all font-mono leading-relaxed">
          {currentUrl}
        </p>
      </div>

      <p className="text-center text-[10.5px] text-[#6a6256] leading-relaxed">
        {config.appName} で開き直すと、 そのまま続きから始まります
      </p>
    </div>
  );
}
