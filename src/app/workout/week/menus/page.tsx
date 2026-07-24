import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getCustomMenus } from "@/lib/workout/custom-queries";
import { CustomMenuRow } from "./CustomMenuRow";

export const dynamic = "force-dynamic";

/** じぶんメニュー棚。自分で作ったじぶんメニューだけを並べる(2026-07-24・のり配布複製段は撤去)。 */
export default async function MenusPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const custom = await getCustomMenus();

  return (
    <>
      <MemberHeader title="じぶんメニュー棚" fallbackHref="/workout/week" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto flex max-w-[460px] flex-col gap-2 px-4 py-4">
          <div className="px-0.5 text-[10px] font-extrabold text-[#6a6256]">じぶんメニュー</div>
          {custom.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-4 text-center text-[12px] text-[#a59b8c]">
              まだじぶんメニューはありません。下の「新しく組む」から作れます。
            </p>
          ) : (
            custom.map((m) => <CustomMenuRow key={m.id} menu={m} />)
          )}

          <Link
            href="/workout/week/edit?from=menus"
            className="mt-2 block rounded-2xl border-[1.5px] border-dashed border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f]"
          >
            ＋ 新しく組む（1から）
          </Link>
        </div>
      </main>
    </>
  );
}
