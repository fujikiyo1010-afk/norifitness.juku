"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string;
};

const items: Item[] = [
  {
    label: "プロフィール",
    href: "/admin/settings/profile",
    icon: <UserIcon />,
  },
  {
    label: "テンプレート",
    href: "/admin/settings/templates",
    icon: <TemplateIcon />,
    badge: "準備中",
  },
  {
    label: "通知設定",
    href: "/admin/settings/notifications",
    icon: <BellIcon />,
    badge: "準備中",
  },
  {
    label: "アカウント",
    href: "/admin/settings/account",
    icon: <LockIcon />,
    badge: "近日",
  },
];

export function SettingsSubNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="w-[220px] flex-shrink-0 bg-white border-r border-[#e8ebe9] py-4 px-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-sm transition-colors mb-0.5 ${
              active
                ? "bg-[#00897b]/8 text-[#004d40] font-bold"
                : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto text-[9px] text-zinc-500 bg-zinc-50 border border-[#e8ebe9] px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
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

function UserIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg {...iconProps}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
