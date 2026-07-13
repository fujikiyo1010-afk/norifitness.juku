"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 受講生 UI 下部タブナビ (5 タブ)
 *
 * モック: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 * 確定: 2026-06-09 (screen_master)
 *
 * 表示条件:
 *   - 非表示パス (login / invite / admin / etc) では何も出さない
 *   - PWA standalone 前提のため、 戻り動線として最重要
 *
 * スペーサー方式:
 *   - 表示時は <Spacer> + <nav fixed> の両方を描画
 *   - layout で {children} の後ろに配置すると、 末尾コンテンツがタブで被らない
 *   - 各ページに pb-24 を手で足さない方針 (漏れ + 再発リスク回避)
 */
// 3番目のタブ: ベータ=チャット / 非ベータ=記録(点21・確定7/7)
const TAB_RECORD = { label: "記録", href: "/record", icon: <NoteIcon />, exact: false };
const TAB_CHAT = { label: "チャット", href: "/messages", icon: <ChatIcon />, exact: false };

function tabsFor(isBeta: boolean) {
  return [
    { label: "ホーム", href: "/", icon: <HomeIcon />, exact: true },
    { label: "コース", href: "/courses", icon: <BookIcon />, exact: false },
    isBeta ? TAB_CHAT : TAB_RECORD,
    { label: "筋トレ", href: "/workout", icon: <DumbbellIcon />, exact: false },
    { label: "プロフィール", href: "/profile", icon: <PersonIcon />, exact: false },
  ];
}

const HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/invite",
  "/onboarding", // オンボ中は受講生用ナビを出さない (= Step の「次へ」 ボタンを隠さない)
  "/forgot-password",
  "/reset-password",
  "/debug",
  "/messages", // チャット画面では入力欄を画面下端ピッタリにするためナビ非表示 (2026-06-18 #2)
  "/meals/new", // 食事投稿(P4-a): 下部固定「これで記録する」がナビと重ならないよう非表示
  "/workout/today", // 実施記録(P5): 下部固定「今日のトレ完了」がナビと重ならないよう非表示
];

export function MemberBottomNav({ isBeta = false }: { isBeta?: boolean }) {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  const TABS = tabsFor(isBeta);

  return (
    <>
      {/* スペーサー: タブの物理高さに合わせて末尾に確保 (= 末尾コンテンツが nav に隠れない保証)。
          ブラウザ通常: 60px (= nav 自身 55-60px をカバー)
          PWA + iPhone: 60 + safe-area-inset-bottom (= 34px) = 94px (= nav + ホームインジケータをカバー)
          2026-06-18 改: 固定 h-16 (64px) では PWA で隠れる問題があり動的計算に。 */}
      <div
        aria-hidden
        className="flex-shrink-0"
        style={{
          height: "calc(60px + env(safe-area-inset-bottom))",
        }}
      />

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#fffdf8] border-t border-[#e7dcc9] safe-bottom">
        <div className="mx-auto max-w-md flex">
          {TABS.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-bold transition-colors ${
                  isActive
                    ? "text-[#34603f]"
                    : "text-[#6a6256] hover:text-[#2b2620]"
                }`}
              >
                <span
                  className={`w-6 h-6 flex items-center justify-center ${
                    isActive ? "text-[#4a875b]" : ""
                  }`}
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function BookIcon() {
  // 2026-07-13: コースアイコンを「開いた本」(候補B)に変更。
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DumbbellIcon() {
  // 2026-07-13: コース内(筋トレフォーム)で使っている横型ダンベルSVGに統一。他アイコンより少し大きく(24)。
  return (
    <svg {...iconProps} width="24" height="24">
      <path d="M8.5 12h7" />
      <path d="M6 8.6v6.8" />
      <path d="M3.6 10.2v3.6" />
      <path d="M18 8.6v6.8" />
      <path d="M20.4 10.2v3.6" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}
