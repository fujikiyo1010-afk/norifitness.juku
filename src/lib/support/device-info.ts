"use client";

/**
 * 端末・アプリ版の自動収集 (2026-08-27 新設)
 *
 * 本人には入力させない。管理画面で「どの端末の、どの版で起きているか」を
 * 一目で見るため。★アプリ版が重要 ─ 古い版が端末に残っていると、
 * 直したはずの不具合が再現する (2026-07-29 PWA キャッシュ反映不達)。
 *
 * 取れなくても送信は止めない (すべてベストエフォート)。
 */

export type DeviceInfo = {
  ua?: string;
  platform?: string;
  /** sw.js の CACHE_VERSION (例 v18-2026-08-21-meal-zenkoukai) */
  app_version?: string;
  /** ホーム画面に追加した PWA として開いているか */
  standalone?: boolean;
  screen?: string;
  language?: string;
};

/** caches の名前 (pages-<CACHE_VERSION>) から今の端末のアプリ版を割り出す */
async function readAppVersion(): Promise<string | undefined> {
  try {
    if (typeof caches === "undefined") return undefined;
    const keys = await caches.keys();
    const pages = keys.find((k) => k.startsWith("pages-"));
    return pages ? pages.slice("pages-".length) : undefined;
  } catch {
    return undefined;
  }
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const info: DeviceInfo = {};
  try {
    info.ua = navigator.userAgent;
    info.platform = navigator.platform;
    info.language = navigator.language;
    info.screen = `${window.screen.width}x${window.screen.height}`;
    info.standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari の独自プロパティ
      (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    // 取れないものは入れないだけ
  }
  info.app_version = await readAppVersion();
  return info;
}
