/**
 * Web Push Client-side ヘルパー (2026-06-18 #2 push 基盤)
 *
 * 役割:
 *   - registerServiceWorker  : /sw.js 登録 (1 回ぽっきり、 既登録なら再利用)
 *   - subscribeToPush        : Notification 許可 → PushSubscription 生成 → 返却
 *   - unsubscribeFromPush    : 既存 subscription を端末側 + サーバ DB から解除
 *   - getCurrentSubscription : 現在の subscription endpoint を取得 (UI 状態確認用)
 *
 * 補足:
 *   - iOS 16.4+ は PWA ホーム追加状態でのみ通知が来る (Safari 単体だと不可)
 *   - VAPID public key は NEXT_PUBLIC_VAPID_PUBLIC_KEY 経由でビルド時注入
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export type SubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (e) {
    console.error("[push] SW register failed", e);
    return null;
  }
}

export async function subscribeToPush(): Promise<
  | { ok: true; payload: SubscriptionPayload }
  | { ok: false; error: string }
> {
  if (typeof window === "undefined") {
    return { ok: false, error: "ブラウザ環境ではありません" };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "この端末/ブラウザは Push 非対応です" };
  }
  if (!("Notification" in window)) {
    return { ok: false, error: "Notification API が無効です" };
  }
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pubKey) {
    return { ok: false, error: "VAPID 公開鍵が未設定です" };
  }

  // 許可を要求 (= ブラウザポップアップ)
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, error: "通知の許可がブロックされています" };
  }

  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await registerServiceWorker());
  if (!reg) {
    return { ok: false, error: "Service Worker 登録に失敗しました" };
  }
  // ready 待ち (= active 状態保証)
  await navigator.serviceWorker.ready;

  // 既存 subscription があれば再利用
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey)
          .buffer as ArrayBuffer,
      });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Push 購読に失敗しました",
      };
    }
  }

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "subscription の形式が不正です" };
  }

  return {
    ok: true,
    payload: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    },
  };
}

export async function unsubscribeFromPush(): Promise<{
  ok: boolean;
  endpoint?: string;
}> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false };
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return { ok: false };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: false };
  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();
  return { ok, endpoint };
}

export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}
