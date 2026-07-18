import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isTokutenPreviewUser } from "@/lib/auth/tokuten-preview";
import {
  LINE_TOKUTEN,
  WEBINAR_TOKUTEN,
  countItems,
  type TokutenIconKey,
} from "./data";
import { TokutenIcon } from "./TokutenIcon";

export const metadata = {
  title: "特典ライブラリ | 筋肉塾",
};

/**
 * 特典ライブラリ 入口 (/tokuten)
 *
 * 2026-07-14 新設。ホームの大タイル「特典ライブラリ」から遷移。
 *   入口に 2 つのゲート → LINE無料特典(/tokuten/line) / ウェビナー特典(/tokuten/webinar)。
 * 認証: middleware (src/proxy.ts) で自動。
 */
export default async function TokutenLibraryPage() {
  // 藤田さん限定 仮反映(2026-07-17): 対象外はホームへ
  if (!(await isTokutenPreviewUser())) redirect("/");

  const gates: {
    href: string;
    name: string;
    desc: string;
    count: number;
    icon: TokutenIconKey;
    bg: string;
    fg: string;
  }[] = [
    {
      href: "/tokuten/line",
      name: "LINE無料特典",
      desc: "動画講義・レシピ本・食材リスト・マインドセット",
      count: countItems(LINE_TOKUTEN),
      icon: "book",
      bg: "#eaf3ec",
      fg: "#4a875b",
    },
    {
      href: "/tokuten/webinar",
      name: "ウェビナー特典",
      desc: "ティアリスト・レシピ総集編・家トレダンジョン",
      count: countItems(WEBINAR_TOKUTEN),
      icon: "tier",
      bg: "#f7ece2",
      fg: "#c2693f",
    },
  ];

  return (
    <>
      <MemberHeader title="特典ライブラリ" fallbackHref="/" />
      <main className="min-h-screen bg-[#f5efe3]">
        <div className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-5">
          <p className="mb-5 px-0.5 text-[12.5px] font-medium leading-[1.75] text-[#3a332a]">
            これまでの特典を、すべてここにまとめました。いつでも見返せます。
          </p>
          <div className="flex flex-col gap-3">
            {gates.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="flex items-center gap-[14px] rounded-[16px] border border-[#e7dcc9] bg-[#fffdf8] px-4 py-[18px] no-underline shadow-[0_1px_3px_rgba(90,70,40,0.06)] active:scale-[0.985] transition-transform"
              >
                <span
                  className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[14px]"
                  style={{ backgroundColor: g.bg }}
                >
                  <TokutenIcon name={g.icon} size={26} color={g.fg} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-[1.3] text-[#2b2620]">
                    {g.name}
                  </span>
                  <span className="mt-[3px] block text-[11.5px] leading-[1.5] text-[#8a7f6d]">
                    {g.desc}
                  </span>
                  <span
                    className="mt-[7px] block text-[11px] font-bold"
                    style={{ color: g.fg }}
                  >
                    全 {g.count} 本 ›
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="#c3b8a2"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-1.5 px-0.5 text-[11.5px] font-bold leading-[1.6] text-[#4a875b]">
            <svg
              viewBox="0 0 24 24"
              className="mt-[2px] h-3.5 w-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            <span>新しい特典や最新情報は、入り次第ここに追加します。</span>
          </p>
        </div>
      </main>
    </>
  );
}
