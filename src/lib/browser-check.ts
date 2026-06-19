/**
 * ブラウザ環境判定 (= /invite, /onboarding 共通)
 *
 * 受講生が PWA 化できるブラウザで開いているかを判定し、 サポート外なら
 * 切替案内画面に誘導する。 線① では iPhone / Android スマホで PWA 化できる
 * ブラウザのみサポート:
 *   - iOS Safari      → ✅ 共有メニュー → ホーム画面に追加
 *   - Android Chrome  → ✅ 三点メニュー → アプリをインストール
 *   - その他 (iOS Chrome / Firefox / Samsung Internet / PC ブラウザ等) → 案内
 *
 * SSR では window が無いため "unknown" を返す。 useEffect 経由で再判定する想定。
 */
export type BrowserEnv =
  | "ios-safari"      // ✅ PWA 化 OK
  | "android-chrome"  // ✅ PWA 化 OK
  | "ios-other"       // ❌ iOS Chrome / Firefox / Edge 等 → Safari に誘導
  | "android-other"   // ❌ Android Firefox / Samsung 等 → Chrome に誘導
  | "desktop"         // ❌ PC / Mac ブラウザ → スマホに誘導
  | "unknown";        // SSR 時 / 判定不能

export function detectBrowserEnv(): BrowserEnv {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unknown";
  }

  const ua = navigator.userAgent;

  // iOS Chrome / Firefox / Edge (= WKWebView 経由 = PWA 化不可)
  const isIOSChrome = /CriOS/i.test(ua);
  const isIOSFirefox = /FxiOS/i.test(ua);
  const isIOSEdge = /EdgiOS/i.test(ua);

  // iPhone / iPad / iPod (iPadOS 13+ は Mac UA に偽装するので touch で判定)
  const isIOSDevice = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = /Macintosh/i.test(ua) && "ontouchend" in document;
  const isIOS = isIOSDevice || isIPadOS;

  // iOS Safari (= 公式 Safari のみ / WKWebView 経由は除外)
  const isIOSSafari =
    isIOS && !isIOSChrome && !isIOSFirefox && !isIOSEdge && /Safari/i.test(ua);
  if (isIOSSafari) return "ios-safari";
  if (isIOS) return "ios-other";

  // Android
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    // Samsung Internet / WebView 系を除外 (= PWA 挙動が Chrome と違う)
    const isSamsungInternet = /SamsungBrowser/i.test(ua);
    const isAndroidWebView = /\bwv\b/.test(ua); // Android WebView
    const isAndroidChrome =
      /Chrome/i.test(ua) && !isSamsungInternet && !isAndroidWebView;
    if (isAndroidChrome) return "android-chrome";
    return "android-other";
  }

  // それ以外 (= Mac Safari / Windows Chrome / Linux 等)
  return "desktop";
}

/**
 * 現在の表示が PWA standalone モードか判定 (= ホーム画面追加済 + アイコンから起動)
 *   - matchMedia('(display-mode: standalone)') = Android / iOS 18+ で動く
 *   - iOS 旧来の navigator.standalone = 互換性のため併用
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const matches = window.matchMedia("(display-mode: standalone)").matches;
  const iosLegacy =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return matches || iosLegacy;
}
