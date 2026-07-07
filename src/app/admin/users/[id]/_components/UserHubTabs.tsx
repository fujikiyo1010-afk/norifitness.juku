"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function UserHubTabs({ userId }: { userId: string }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // 学習進捗一覧から飛んだ時だけ ?from=learning が付く
  const fromLearning = searchParams?.get("from") === "learning";
  const base = `/admin/users/${userId}`;

  const tabs = [
    { label: "概要", href: base, exact: true, stayOn: true },
    { label: "体組成推移", href: `${base}/metrics`, exact: false },
    { label: "月次添削履歴", href: `${base}/monthly`, exact: false },
    { label: "筋トレメニュー", href: `${base}/menu`, exact: false },
    { label: "カルテ", href: `${base}/carte`, exact: false },
    { label: "目標シート", href: `${base}/goal-sheet`, exact: false },
    { label: "学習進捗", href: `${base}/learning`, exact: false, stayOn: true },
  ];

  // 学習進捗フロー(?from=learning)では、概要・学習進捗以外のタブを横線+無効化する。
  // 他の動線が理想まで完成したら、この暫定フタ(fromLearning 分岐)を撤去する。
  const suffix = fromLearning ? "?from=learning" : "";

  return (
    <div className="bg-white border-b border-[#e8ebe9] sticky top-0 z-[5]">
      <div className="mx-auto max-w-3xl px-4 flex gap-1 overflow-x-auto overflow-y-hidden">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const locked = fromLearning && !tab.stayOn;

          if (locked) {
            // 動線未完成のタブ: クリック不可 + 取り消し線 + ツールチップ
            return (
              <span
                key={tab.href}
                title="動線反映中"
                aria-disabled="true"
                className="px-3 py-3 text-[13px] font-semibold border-b-2 border-transparent whitespace-nowrap -mb-px text-zinc-300 line-through cursor-not-allowed select-none"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link
              key={tab.href}
              href={`${tab.href}${suffix}`}
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
