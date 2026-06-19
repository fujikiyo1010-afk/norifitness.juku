import Link from "next/link";
import { ReloadButton } from "./ReloadButton";

/**
 * オフライン画面 (2026-06-19 D-γ ・ Service Worker から fallback)
 *
 * - Service Worker (= public/sw.js) で network 失敗時に自動で返される
 * - キャッシュにあるページは表示される、 そうでないときだけここに来る
 * - ティール緑 ブランド統一 + アクション 2 つ ・ シンプル設計
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#f9f5ed] px-6">
      <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-8 max-w-sm text-center shadow-sm">
        <div className="mx-auto w-16 h-16 mb-5 text-[#a59b8c]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full"
          >
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <h1 className="text-base font-bold text-[#2b2620] mb-2">
          オフラインです
        </h1>

        <p className="text-xs text-[#6a6256] leading-relaxed mb-6">
          ネット接続を確認してください。
          <br />
          接続が戻ると自動で復旧します。
        </p>

        <div className="space-y-2">
          <ReloadButton />
          <Link
            href="/"
            className="block w-full bg-[#fffdf8] border border-[#e7dcc9] text-[#2b2620] rounded-xl px-4 py-3 text-sm font-bold hover:bg-[#f0e6d3] transition-colors"
          >
            ホームへ
          </Link>
        </div>
      </div>

      <p className="text-[10px] text-[#a59b8c] mt-6 text-center">
        のりfitness 筋肉塾
      </p>
    </main>
  );
}
