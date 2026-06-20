/* eslint-disable no-restricted-globals */
// 筋肉塾 PWA Service Worker (2026-06-19 D-γ 強化版)
//
// 役割:
//   1. push 通知 (= 既存 / 2026-06-18 から)
//   2. notificationclick (= 既存 / 堅牢化済)
//   3. ★ オフライン fallback (= 電波切れた時に「オフラインです」 画面を出す)
//   4. ★ ナビゲーション キャッシュ (= 一度開いたページを再訪時 瞬時表示)
//   5. ★ 静的アセット キャッシュ (= /icons / 画像等を network-first → cache-fallback)

const CACHE_VERSION = "v2-2026-06-20-layout";
const CACHE_PAGES = `pages-${CACHE_VERSION}`;
const CACHE_STATIC = `static-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

// ─── インストール: オフライン画面を pre-cache ───
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGES);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (e) {
        // OFFLINE_URL が未デプロイ環境は失敗するが、 致命的ではない
        console.warn("[sw] precache partial fail", e);
      }
    })()
  );
});

// ─── アクティベート: 古い cache 削除 ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_PAGES && n !== CACHE_STATIC)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// ─── fetch: ルーティング戦略 ───
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // POST / 他は素通し (= Server Actions / API は always network)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 同一オリジン以外は素通し (= Supabase / Vimeo / Resend 等)
  if (url.origin !== self.location.origin) return;

  // Next.js 内部 / API ルート / Supabase auth は cache せず素通し
  if (
    url.pathname.startsWith("/_next/data") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // ナビゲーションリクエスト (= HTML ページ取得)
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 静的アセット (= /icons, /images, /_next/static 等)
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirstWithRevalidate(request, CACHE_STATIC));
    return;
  }

  // それ以外 (= CSS / JS バンドル) は network-first
  event.respondWith(networkFirst(request, CACHE_STATIC));
});

// ─── ナビゲーション = network-first + オフライン fallback ───
async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      // 成功した HTML をキャッシュ (= 次回オフライン時に使える)
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    // オフライン → cache 試行 → だめなら offline page
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", { status: 503 });
  }
}

// ─── 静的アセット = cache-first + 裏で revalidate ───
async function cacheFirstWithRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkPromise) || new Response("", { status: 504 });
}

// ─── 一般 = network-first + cache fallback ───
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

// ====================================================================
// push 通知系 (= 既存ロジック保持 ・ 2026-06-18 から)
// ====================================================================

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
    tag: payload.tag || undefined,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || "/";
  const absoluteUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      try {
        const clientList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          if (!("focus" in client)) continue;
          try {
            await client.focus();
            if ("navigate" in client) {
              try {
                await client.navigate(absoluteUrl);
              } catch (e) {
                // navigate 不能環境は focus のみ
              }
            }
            return;
          } catch (e) {
            // 次の client へ
          }
        }
        if (!self.clients.openWindow) return;
        try {
          await self.clients.openWindow(absoluteUrl);
        } catch (e) {
          await new Promise((r) => setTimeout(r, 250));
          try {
            await self.clients.openWindow(absoluteUrl);
          } catch (e2) {
            console.error("[sw] openWindow failed twice", e2);
          }
        }
      } catch (e) {
        console.error("[sw] notificationclick failed", e);
      }
    })()
  );
});
