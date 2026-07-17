import { TokutenIcon } from "./TokutenIcon";
import type { TokutenGroup } from "./data";

/**
 * 特典カードの一覧 (種類でグループ分け)。
 * 各特典の実体は public/tokuten/<file>.html の静的ページなので、
 * アプリのルーティングではなく通常の <a> で全ページ遷移させる。
 */
export function TokutenList({ groups }: { groups: TokutenGroup[] }) {
  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mt-4 mb-2 px-0.5 text-[11px] font-bold tracking-[0.08em] text-[#a99a80] first:mt-0">
            {group.label}
          </div>
          <div className="flex flex-col gap-[9px]">
            {group.items.map((it) => (
              <a
                key={it.file}
                href={`/tokuten/${it.file}`}
                className="flex items-center gap-3 rounded-[13px] border border-[#e7dcc9] bg-[#fffdf8] px-[14px] py-[13px] no-underline active:scale-[0.99] transition-transform"
              >
                <span
                  className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: it.bg }}
                >
                  <TokutenIcon name={it.icon} color={it.fg} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold leading-[1.35] text-[#2b2620]">
                    {it.title}
                  </span>
                  {it.n && (
                    <span className="mt-0.5 block text-[10px] text-[#a99a80]">
                      特典 {it.n}
                    </span>
                  )}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-[14px] w-[14px] flex-shrink-0"
                  fill="none"
                  stroke="#cabfa8"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
