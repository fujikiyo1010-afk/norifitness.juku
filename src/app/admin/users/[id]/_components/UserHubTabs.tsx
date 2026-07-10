"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function UserHubTabs({ userId }: { userId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/admin/users/${userId}`;

  const tabs = [
    { label: "概要", href: base, exact: true },
    { label: "体組成推移", href: `${base}/metrics`, exact: false },
    { label: "食事記録", href: `${base}/meals`, exact: false },
    { label: "月次添削履歴", href: `${base}/monthly`, exact: false },
    { label: "筋トレメニュー", href: `${base}/menu`, exact: false },
    { label: "カルテ", href: `${base}/carte`, exact: false },
    { label: "目標シート", href: `${base}/goal-sheet`, exact: false },
    { label: "学習進捗", href: `${base}/learning`, exact: false },
  ];

  // 2026-07-09 管S5: 学習進捗フローの暫定フタ(?from=learning で他タブを横線無効化)を撤去。
  // ナビ再編(P1)で受講生ハブが常設動線になったため、全タブを常時開放する。

  return (
    <div className="bg-white border-b border-[#e8ebe9] sticky top-0 z-[5]">
      <div className="mx-auto max-w-3xl px-4 flex gap-1 overflow-x-auto overflow-y-hidden">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                isActive
                  ? "border-[#00897b] text-[#004d40]"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
