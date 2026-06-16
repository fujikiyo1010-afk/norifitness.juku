import type { ReactNode, SVGProps } from "react";

/**
 * 新しい筋肉塾 — 統一アイコンライブラリ（スタイルA: 洗練ライン）
 *
 * 方針:
 *   - 線画・currentColor 一色（色は親要素の text-* で制御）
 *   - viewBox 0 0 24 24 / 線幅・端の処理を全アイコンで統一
 *   - size で表示寸法を可変（既定24px）。strokeWidth も上書き可
 *   - 旧来の各ファイル散在アイコン（30個・重複多数）をここへ集約
 *
 * 使い方:
 *   import { HomeIcon, DumbbellIcon } from "@/components/icons";
 *   <HomeIcon size={22} />
 *   <DumbbellIcon className="text-[#00897b]" />
 *
 * 設計ルール（許可絵文字は ✓ ▶ → ← のみ、の方針は維持）
 */

export type IconProps = {
  /** 一辺のpxサイズ。既定 24 */
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

function Svg({
  size = 24,
  strokeWidth = 1.75,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ============================ ナビ・基本 ============================ */

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 11.3 12 4l8.5 7.3" />
      <path d="M5.6 10v9.4a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V10" />
      <path d="M10 20.4v-4.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.6" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.8" />
      <path d="m20 20-4-4" />
    </Svg>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </Svg>
  );
}
/** 別名: 旧 CogIcon */
export const CogIcon = SettingsIcon;

export function BellIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5H4.5s2-1.5 2-6.5Z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
    </Svg>
  );
}

/* ============================ 人・連絡 ============================ */

export function UserIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 20v-1.6a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
      <circle cx="12" cy="8" r="3.6" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M19.5 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M15 5.1a3.2 3.2 0 0 1 0 5.8" />
    </Svg>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.3 7.5-5.3" />
    </Svg>
  );
}
/** 別名: 旧 MailMiniIcon（小サイズで <MailIcon size={10} /> 推奨） */
export const MailMiniIcon = MailIcon;

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 11.5a7.5 7.5 0 0 1-10.4 6.9L5 20l1.1-3.6A7.5 7.5 0 1 1 20 11.5Z" />
      <circle cx="8.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}
/** 別名: 旧 ThoughtIcon */
export const ThoughtIcon = ChatIcon;

/* ============================ 学習・記録 ============================ */

export function BookIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4.5A2 2 0 0 1 7 2.5h11a.8.8 0 0 1 .8.8v15.4a.8.8 0 0 1-.8.8H7a2 2 0 0 0-2 2Z" />
      <path d="M5 18.5V4.5" />
    </Svg>
  );
}

export function BookOpenIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2" />
      <path d="M12 6.5C13.5 5 16 4.5 20 4.5v13c-4 0-6.5.5-8 2" />
      <path d="M12 6.5V21" />
    </Svg>
  );
}

export function BookmarkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}
/** 別名: 旧 ChapterMarkIcon */
export const ChapterMarkIcon = BookmarkIcon;

export function EditIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20h8" />
      <path d="M16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1 1-4Z" />
    </Svg>
  );
}
/** 別名: 旧 PenIcon / PencilIcon / NoteIcon */
export const PenIcon = EditIcon;
export const PencilIcon = EditIcon;
export const NoteIcon = EditIcon;

export function DocIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 3.5h7l5 5V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20Z" />
      <path d="M13 3.5V8.5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </Svg>
  );
}

/* ============================ データ・目標 ============================ */

export function BarChartIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <rect x="7.5" y="12" width="2.8" height="5" rx="0.6" />
      <rect x="12.5" y="8.5" width="2.8" height="8.5" rx="0.6" />
      <rect x="17.5" y="5.5" width="2.8" height="11.5" rx="0.6" />
    </Svg>
  );
}
/** 別名: 旧 BarIcon / ChartIcon */
export const BarIcon = BarChartIcon;
export const ChartIcon = BarChartIcon;

export function TrendingUpIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 16 9.5 10.5l3.2 3.2L20 6.4" />
      <path d="M15.5 6.4H20v4.5" />
    </Svg>
  );
}

export function TargetIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m8.5 12 2.4 2.4 4.6-4.8" />
    </Svg>
  );
}
/** 別名: 旧 CheckIcon */
export const CheckIcon = CheckCircleIcon;

/* ============================ 機能・その他 ============================ */

export function VideoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="M15.5 10.2 21 7v10l-5.5-3.2" />
    </Svg>
  );
}

export function TruckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V16H3Z" />
      <path d="M14 9h3.2a1 1 0 0 1 .8.4L20.6 13a1 1 0 0 1 .4.8V16h-7" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </Svg>
  );
}

export function ToolIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

export function BoltIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2.5 4.5 13.2a.6.6 0 0 0 .5.95H11l-1 7.35 8.5-10.7a.6.6 0 0 0-.5-.95H13Z" />
    </Svg>
  );
}
/** 別名: 旧 TemplateIcon */
export const TemplateIcon = BoltIcon;

/* ============================ ブランド ============================ */

export function DumbbellIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.5 12h7" />
      <path d="M6 8.6v6.8" />
      <path d="M3.6 10.2v3.6" />
      <path d="M18 8.6v6.8" />
      <path d="M20.4 10.2v3.6" />
    </Svg>
  );
}

/** 力こぶ（筋肉塾ブランドモチーフ） */
export function FlexIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 7v4a5 5 0 0 0 5 5h2" />
      <path d="M5 7h5a3 3 0 0 1 3 3c3 .2 5 2.2 5 5v3" />
      <path d="M5 16.5V20" />
      <path d="M9 16v4" />
    </Svg>
  );
}
