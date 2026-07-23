import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getLastWeekMenus } from "@/lib/workout/custom-queries";
import { menuAbbr } from "@/lib/workout/weekly";

export const dynamic = "force-dynamic";

/** 先週から選ぶ(モック画面9)。先週やった配布/じぶんを「今日やる」で今週に再投入。 */
export default async function LastWeekPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const entries = await getLastWeekMenus();

  return (
    <>
      <MemberHeader title="先週から選ぶ" fallbackHref="/workout/week" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto flex max-w-[460px] flex-col gap-2 px-4 py-4">
          <p className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2.5 text-[11.5px] font-bold text-[#34603f]">
            先週やったものから、もう一度やるメニューを選べます。
          </p>
          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-6 text-center text-[12px] text-[#a59b8c]">
              先週の実施記録はありません。
            </p>
          ) : (
            entries.map((e, i) => {
              // 先週=実績が初期値でセット表へ(共通線・§2-9)
              const href = `/workout/week/edit?last=${e.logId}&from=last`;
              return (
                <Link
                  key={i}
                  href={href}
                  className="flex items-center gap-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5"
                >
                  <span
                    className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[9px] px-2 text-[10px] font-extrabold text-white"
                    style={{ background: e.kind === "custom" ? "#7a5af0" : e.color }}
                  >
                    {e.kind === "custom" ? "じ" : menuAbbr(e.label)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[12.5px] text-[#2b2620]">{e.label}</b>
                    <span className="text-[10px] font-bold text-[#6a6256]">{e.dayLabel}</span>
                  </div>
                  <span className="flex-none rounded-full border-[1.5px] border-[#4a875b] px-2.5 py-1 text-[10px] font-extrabold text-[#34603f]">
                    今日やる
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
