"use client";

import { useEffect, useState, useTransition } from "react";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscriptionEndpoint,
} from "@/lib/push/client";
import {
  saveSubscription,
  deleteSubscription,
  sendTestPushToMe,
} from "@/lib/push/actions";

/**
 * /account 「アプリ通知」 行 (2026-06-18 #2 push 基盤デモ版)
 *
 * 表示:
 *   - 端末対応外            : 「この端末は対応していません」 (グレー)
 *   - 未許可 + 端末対応      : 「有効にする」 ボタン
 *   - 許可済                : 「テスト通知を送る」 ボタン + 「解除」 リンク
 *   - エラー                : 1 行赤字
 *
 * iOS Safari 注意:
 *   - ホーム追加した PWA 起動でしか購読不可。 ブラウザでは 「非対応扱い」 にして導線を出す
 */
export function PushNotificationRow() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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

  function handleEnable() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const r = await subscribeToPush();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const saved = await saveSubscription(r.payload);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setSubscribed(true);
      setInfo("通知を有効にしました");
    });
  }

  function handleTest() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const r = await sendTestPushToMe();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInfo("テスト通知を送信しました");
    });
  }

  function handleDisable() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const { endpoint } = await unsubscribeFromPush();
      if (endpoint) {
        await deleteSubscription(endpoint);
      }
      setSubscribed(false);
      setInfo("通知を解除しました");
    });
  }

  if (supported === null) {
    return <div className="text-[11px] text-[#a59b8c]">確認中…</div>;
  }

  if (!supported) {
    return (
      <div className="text-[11px] text-[#a59b8c] text-right leading-tight">
        この端末は非対応
        <br />
        (ホームに追加して開いてください)
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!subscribed ? (
        <button
          type="button"
          onClick={handleEnable}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg bg-[#4a875b] text-white text-[11px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-60"
        >
          {pending ? "処理中..." : "有効にする"}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={handleTest}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-[#4a875b] text-white text-[11px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-60"
          >
            {pending ? "送信中..." : "テスト通知を送る"}
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={pending}
            className="text-[10px] text-[#a59b8c] hover:text-[#6a6256] underline-offset-2 hover:underline"
          >
            通知を解除
          </button>
        </>
      )}
      {info && <div className="text-[10px] text-[#34603f]">{info}</div>}
      {error && <div className="text-[10px] text-rose-600">{error}</div>}
    </div>
  );
}
