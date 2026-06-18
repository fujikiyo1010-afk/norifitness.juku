import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { MemberBottomNav } from "@/components/MemberBottomNav";

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
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4a875b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",   // PWA standalone で safe-area-inset を有効化 (= 下部ナビが iPhone ホームインジケータの上に浮く)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f9f5ed]">
        {children}
        <PWAInstallBanner />
        <MemberBottomNav />
      </body>
    </html>
  );
}
