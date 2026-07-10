import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { MemberBottomNav } from "@/components/MemberBottomNav";
import { isBetaUser } from "@/lib/auth/beta";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { BootSplash } from "@/components/BootSplash";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "筋肉塾 | のりfitness",
  description: "のりfitness 筋肉塾の受講生専用 学習プラットフォーム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "筋肉塾",
    statusBarStyle: "default",
    // iOS PWA 起動画像 (= 層A)。タップ直後の白画面を BootSplash と同じ止め絵に置換。
    // 機種ごとに device-width/height + dpr が一致した画像が選ばれる。
    // 画像は public/splash/ (Playwright で BootSplash の止め絵を解像度別に書き出し)。
    startupImage: [
      {
        url: "/splash/apple-splash-640-1136.png",
        media:
          "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1080-2340.png",
        media:
          "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-750-1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1242-2208.png",
        media:
          "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1125-2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-828-1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1242-2688.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1170-2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1284-2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1179-2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1290-2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1206-2622.png",
        media:
          "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1320-2868.png",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS の起動画像 (apple-touch-startup-image) は apple 専用の capable メタが
  // 無いと表示されないことがある。Next は mobile-web-app-capable しか吐かないため明示追加。
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#4a875b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",   // PWA standalone で safe-area-inset を有効化 (= 下部ナビが iPhone ホームインジケータの上に浮く)
  colorScheme: "light",   // 受講生 UI は ベージュ+ティール緑 で世界観統一 = ダークモード時の中途半端なミスマッチを防ぐ
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 点21: 下ナビ3番目をベータはチャット/非ベータは記録に出し分け(確定7/7)
  const isBeta = await isBetaUser();
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f9f5ed]">
        <Suspense fallback={null}>
          <BootSplash />
        </Suspense>
        {children}
        <MemberBottomNav isBeta={isBeta} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
