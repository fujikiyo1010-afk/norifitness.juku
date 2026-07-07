"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type BadgeTone = "neutral" | "danger";

type NavItem = {
  label: string;
  href: string;
  matchPrefix: string;
  icon: ReactNode;
  badge?: number;
  badgeTone?: BadgeTone;
};

export type AdminSideNavProps = {
  adminName: string;
  totalUsers: number;
  pendingAudits: number;
  pendingRequests: number;
  pendingShipments: number;
  chatUnread: number;
};

export function AdminSideNav({
  adminName,
  totalUsers,
  pendingAudits,
  pendingRequests,
  pendingShipments,
  chatUnread,
}: AdminSideNavProps) {
  const pathname = usePathname() ?? "/admin";

  const items: NavItem[] = [
    {
      label: "ホーム",
      href: "/admin",
      matchPrefix: "/admin",
      icon: <HomeIcon />,
    },
    {
      label: "受講生",
      href: "/admin/users",
      matchPrefix: "/admin/users",
      icon: <UsersIcon />,
      badge: totalUsers,
      badgeTone: "neutral",
    },
    {
      label: "月次添削",
      href: "/admin/monthly-reviews",
      matchPrefix: "/admin/monthly-reviews",
      icon: <VideoIcon />,
      badge: pendingAudits,
      badgeTone: "danger",
    },
    {
      label: "リクエスト",
      href: "/admin/requests",
      matchPrefix: "/admin/requests",
      icon: <ClipboardIcon />,
      badge: pendingRequests,
      badgeTone: "danger",
    },
    {
      label: "チャット",
      href: "/admin/messages",
      matchPrefix: "/admin/messages",
      icon: <ChatIcon />,
      badge: chatUnread,
      badgeTone: "danger",
    },
    {
      label: "発送管理",
      href: "/admin/shipments",
      matchPrefix: "/admin/shipments",
      icon: <TruckIcon />,
      badge: pendingShipments,
      badgeTone: "danger",
    },
    {
      label: "招待",
      href: "/admin/invitations",
      matchPrefix: "/admin/invitations",
      icon: <MailIcon />,
    },
    {
      label: "アナウンス",
      href: "/admin/announcements",
      matchPrefix: "/admin/announcements",
      icon: <MegaphoneIcon />,
    },
    {
      label: "コース管理",
      href: "/admin/courses",
      matchPrefix: "/admin/courses",
      icon: <BookIcon />,
    },
    {
      label: "学習進捗",
      href: "/admin/learning",
      matchPrefix: "/admin/learning",
      icon: <ChartIcon />,
    },
    {
      label: "動画ライブラリ",
      href: "/admin/videos",
      matchPrefix: "/admin/videos",
      icon: <FilmIcon />,
    },
    {
      label: "管理者",
      href: "/admin/admins",
      matchPrefix: "/admin/admins",
      icon: <ShieldIcon />,
    },
    {
      label: "設定",
      href: "/admin/settings",
      matchPrefix: "/admin/settings",
      icon: <SettingsIcon />,
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.href === "/admin") return pathname === "/admin";
    return pathname.startsWith(item.matchPrefix);
  };

  return (
    <nav className="w-[220px] flex-shrink-0 bg-zinc-900 text-zinc-300 flex flex-col">
      {/* ブランド */}
      <div className="px-[18px] pt-[18px] pb-[14px] border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-base mb-2">
          の
        </div>
        <div className="text-sm font-bold text-white leading-tight">
          のりfitness
        </div>
        <div className="text-[11px] text-zinc-300 mt-0.5">筋肉塾 管理</div>
      </div>

      {/* メニュー */}
      <div className="flex-1 py-3 px-2">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-[9px] rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
                active
                  ? "bg-[#00897b]/20 text-white font-bold"
                  : "text-zinc-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-[18px] h-[18px] flex-shrink-0">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-auto text-[10px] font-bold px-[7px] py-px rounded-full font-mono ${
                    item.badgeTone === "danger"
                      ? "bg-red-500 text-white"
                      : "bg-zinc-600 text-zinc-100"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* フッター (管理者) */}
      <div className="px-[14px] py-3 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
          {adminName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">
            {adminName}
          </div>
          <div className="text-[10px] text-zinc-300">管理者</div>
        </div>
      </div>
    </nav>
  );
}

// =====================================================================
// SVG アイコン (Lucide ベース ・ 線画 18×18)
// =====================================================================

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
    <svg {...iconProps}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 2h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 11l18-5v12L3 13z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
