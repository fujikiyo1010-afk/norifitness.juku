import type { TokutenIconKey } from "./data";

/**
 * 特典カード用 線画アイコン (絵文字は使わない・受講生UIの原則)
 */
const PATHS: Record<TokutenIconKey, React.ReactNode> = {
  video: (
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  food: (
    <path d="M3 2v7c0 1.1.9 2 2 2h1v11h2V2H3zm5 0v9c0 .5.5 1 1 1v9h2V2H8zM16 2c-1.7 0-3 1.3-3 3v7h2v9h2V2z" />
  ),
  list: (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </>
  ),
  mind: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a10 10 0 0 0-7 17" />
      <path d="M12 22a10 10 0 0 0 7-17" />
    </>
  ),
  tier: (
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  ),
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </>
  ),
};

export function TokutenIcon({
  name,
  size = 19,
  color,
}: {
  name: TokutenIconKey;
  size?: number;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
