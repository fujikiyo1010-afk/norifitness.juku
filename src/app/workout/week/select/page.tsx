import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";

export const dynamic = "force-dynamic";

/** 「今日のメニューを選ぶ」(モック画面3)。済みは非表示にせず薄く残す(2回目可)。カード→セット表直行。 */
export default async function WeekSelectPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const wk = await getWeeklyTraining();

  const train = wk.distMenus.filter((m) => m.kind === "train");
  const remaining = train.filter((m) => !m.doneThisWeek).length;

  return (
    <>
      <MemberHeader title="今日のメニューを選ぶ" fallbackHref="/workout/week" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
          <p className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2.5 text-[11.5px] font-bold text-[#34603f]">
            どのメニューを選んでもOK。体調や気分に合わせてどうぞ。
          </p>
          <div className="px-0.5 text-[10px] font-extrabold text-[#6a6256]">今週のメニュー（残り{remaining}）</div>

          {train.map((m) => (
            <Link
              key={m.index}
              href={`/workout/week/edit?day=${m.index}&from=select`}
              className={`flex items-center gap-3 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5 ${
                m.doneThisWeek ? "opacity-50" : ""
              }`}
            >
              <span
                className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[9px] px-1.5 text-[11px] font-extrabold text-white"
                style={{ background: m.color }}
              >
                {m.abbr}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-[13px] text-[#2b2620]">{m.name}</b>
                <span className="text-[10px] font-bold text-[#6a6256]">
                  {m.doneThisWeek ? "今週 実施済み ✓" : `${m.exCount}種目`}
                </span>
              </div>
              <span className="text-[#a59b8c]">›</span>
            </Link>
          ))}

          {train.length === 0 && (
            <div className="rounded-2xl border border-[#cfe3d6] bg-[#eaf3ec] px-3.5 py-4 text-center text-[12.5px] font-bold text-[#34603f]">
              配布メニューがまだありません。
            </div>
          )}

          {/* 休養日(常設・点線カード)→ 表紙直行(§2-8) */}
          <Link
            href="/workout/week/confirm?rest=1"
            className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[#ebc9a6] bg-[#fffbe6] px-3 py-2.5"
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#c9a227] text-[12px] font-extrabold text-white">
              休
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-[13px] text-[#2b2620]">休養日・ストレッチ</b>
              <span className="text-[10px] font-bold text-[#6a6256]">疲労回復も大事なトレーニングです</span>
            </div>
            <span className="text-[#a59b8c]">›</span>
          </Link>
        </div>
      </main>
    </>
  );
}
