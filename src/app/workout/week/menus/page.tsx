import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";
import { getCustomMenus } from "@/lib/workout/custom-queries";
import { CustomMenuRow } from "./CustomMenuRow";

export const dynamic = "force-dynamic";

/** じぶんメニュー棚(モック画面7・2段)。上=じぶん(紫)/下=のり配布(緑)。 */
export default async function MenusPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const [custom, wk] = await Promise.all([getCustomMenus(), getWeeklyTraining()]);
  const distTrain = wk.distMenus.filter((m) => m.kind === "train");

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

          <div className="mt-2 px-0.5 text-[10px] font-extrabold text-[#6a6256]">のりの配布メニューから複製</div>
          {distTrain.map((m) => (
            <div key={m.index} className="flex items-center gap-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5">
              <span
                className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[9px] px-1.5 text-[10px] font-extrabold text-white"
                style={{ background: m.color }}
              >
                {m.abbr}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[12.5px] text-[#2b2620]">{m.name}</b>
                <span className="text-[10px] font-bold text-[#6a6256]">{m.exCount}種目</span>
              </div>
              <Link href={`/workout/week/edit?day=${m.index}&from=menus`} className="flex-none rounded-full border-[1.5px] border-[#4a875b] px-2.5 py-1 text-[10px] font-extrabold text-[#34603f]">
                今日やる
              </Link>
              <Link href={`/workout/week/edit?copyDist=${m.index}&from=menus`} className="flex-none rounded-full border-[1.5px] border-[#d8cdba] px-2.5 py-1 text-[10px] font-extrabold text-[#6a6256]">
                複製
              </Link>
            </div>
          ))}

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
