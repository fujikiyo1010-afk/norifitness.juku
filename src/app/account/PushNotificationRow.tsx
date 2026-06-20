"use client";

import { useEffect, useState, useTransition } from "react";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscriptionEndpoint,
} from "@/lib/push/client";
import { saveSubscription, deleteSubscription } from "@/lib/push/actions";

/**
 * /account 「アプリ通知」 行 ・ トグル UI (2026-06-20 線① 受講生 UI 整理)
 *
 * 表示:
 *   - 端末対応外    : 「この端末は非対応」 (= グレー)
 *   - 端末対応      : トグル ON/OFF (= メール通知トグルと統一)
 *   - エラー        : 下に赤字
 *
 * 旧仕様 (= 2026-06-18 デモ版) のテストボタン 3 種 (= テスト送信 / 10 秒後 / リンク付き) は
 * 受講生に出ては困るため完全削除。 動作確認は admin の別経路でのみ実施。
 *
 * iOS Safari 注意:
 *   - ホーム追加した PWA 起動でしか購読不可。 ブラウザでは 「非対応扱い」 にして導線を出す
 */
export function PushNotificationRow() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let canceled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!isSupported) {
        if (!canceled) setSupported(false);
        return;
      }
      const endpoint = await getCurrentSubscriptionEndpoint();
      if (!canceled) {
        setSupported(true);
        setSubscribed(!!endpoint);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  function handleToggle() {
    if (pending) return;
    setError(null);
    const next = !subscribed;

    if (next) {
      // ON 化: iOS 許可ダイアログ → subscription 取得 → DB 保存
      // 楽観 UI: 即 ON 表示 → 失敗時ロールバック
      setSubscribed(true);
      startTransition(async () => {
        const r = await subscribeToPush();
        if (!r.ok) {
          setSubscribed(false);
          setError(r.error);
          return;
        }
        const saved = await saveSubscription(r.payload);
        if (!saved.ok) {
          setSubscribed(false);
          setError(saved.error);
        }
      });
    } else {
      // OFF 化: 端末 + DB から subscription 削除
      setSubscribed(false);
      startTransition(async () => {
        const { endpoint } = await unsubscribeFromPush();
        if (endpoint) {
          await deleteSubscription(endpoint);
        }
      });
    }
  }

  if (supported === null) {
    return <div className="text-[11px] text-[#a59b8c]">確認中…</div>;
  }

  if (!supported) {
    return (
      <div className="text-[11px] text-[#a59b8c] text-right leading-tight">
        この端末は非対応
        <br />
        (ホームに追加してください)
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={subscribed}
        aria-label={`アプリ通知を${subscribed ? "オフ" : "オン"}にする`}
        disabled={pending}
        className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${
          subscribed ? "bg-[#4a875b] justify-end" : "bg-zinc-300 justify-start"
        } disabled:opacity-50`}
      >
        <span className="w-4 h-4 rounded-full bg-[#fffdf8] shadow-sm" />
      </button>
      {error && (
        <div className="text-[10px] text-rose-600 max-w-[180px] text-right leading-tight">
          {error}
        </div>
      )}
    </div>
  );
}
