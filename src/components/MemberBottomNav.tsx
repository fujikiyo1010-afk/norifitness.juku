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
const TABS = [
  { label: "ホーム", href: "/", icon: <HomeIcon />, exact: true },
  { label: "コース", href: "/courses", icon: <BookIcon />, exact: false },
  { label: "記録", href: "/record", icon: <NoteIcon />, exact: false },
  { label: "月次添削", href: "/monthly-review", icon: <ClipboardCheckIcon />, exact: false },
  { label: "設定", href: "/account", icon: <CogIcon />, exact: false },
];

const HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/debug",
  "/messages", // チャット画面では入力欄を画面下端ピッタリにするためナビ非表示 (2026-06-18 #2)
];

export function MemberBottomNav() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* スペーサー: タブと同じ高さの空ブロックを末尾に挟む。
          layout で {children} の後ろに配置することで、 ページ末尾コンテンツが
          fixed のタブと被らない。 各ページへの pb-24 追加が不要。
          2026-06-18: h-24 (96px) → h-16 (64px) に縮小 (= nav 上の空き削減)。 */}
      <div aria-hidden className="h-16 flex-shrink-0" />

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
  return (
    <svg {...iconProps} width="22" height="22">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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

function SearchIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4h6" />
      <path d="m9.5 12 2 2 3.5-4" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg {...iconProps} width="22" height="22">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
