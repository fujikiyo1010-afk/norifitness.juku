/* eslint-disable no-restricted-globals */
// 筋肉塾 PWA Service Worker (2026-06-18 Web Push 基盤)
//
// 役割:
//   1. インストール / アクティベート (基本)
//   2. push イベント受信 → showNotification でバナー表示
//   3. notificationclick → 指定 URL or アプリトップを開く
//
// オフラインキャッシュ等は線② スコープ。 ここは push 専用最小実装。

self.addEventListener("install", (event) => {
  // 旧 SW を即時置換 (= 新版を待たずに切り替え)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // すぐ全クライアント (タブ / PWA) を制御下に
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "通知", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "筋肉塾";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: payload.url || "/",
    },
    tag: payload.tag || undefined, // 同じ tag は上書き
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 既に開いてるクライアントがあれば focus & navigate
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              try {
                client.navigate(targetUrl);
              } catch (e) {
                // navigate 不能環境はそのまま focus のみ
              }
            }
            return;
          }
        }
        // なければ新規 open
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
