import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";
import { getWorkoutForCalendar } from "@/lib/calendar/queries";
import { getRecordStreak } from "@/lib/member/record-streak";
import { getTodayActivity } from "@/lib/member/today-activity";
import { jstTodayStr } from "@/lib/date/jst";
import { WorkoutDoneCelebration } from "@/app/workout/today/WorkoutDoneCelebration";

export const dynamic = "force-dynamic";

/** "YYYY-MM-DD" → "M月D日（曜）"。 */
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, day).getDay()];
  return `${m}月${day}日（${wd}）`;
}

/**
 * 完了画面。
 *  - ?done=1        : 今日の完了祝福(WorkoutDoneCelebration)。
 *  - ?recorded=1&date=YYYY-MM-DD[&mode=update] : 過去日記録(バックデート)の淡い確認。
 *    今日の祝福とは別トーンで「トレーニングを記録/更新しました」。
 */
export default async function WeekDonePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; recorded?: string; date?: string; mode?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;

  // ---- 過去日記録の確認(祝福ではない) ----
  if (sp.recorded === "1") {
    const date =
      sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= jstTodayStr() ? sp.date : null;
    if (!date) redirect("/workout/week/history");
    const isUpdate = sp.mode === "update";
    const w = await getWorkoutForCalendar(date);
    const summary =
      w.state === "done"
        ? `${w.menuName || (w.isCustom ? "じぶんメニュー" : "トレーニング")}${w.exCount > 0 ? `・${w.exCount}種目` : ""}`
        : w.state === "rest"
          ? "休養日"
          : "";
    return (
      <>
        <MemberHeader title={isUpdate ? "更新しました" : "記録しました"} fallbackHref="/workout/week/history" />
        <main className="min-h-[100dvh] bg-[#f9f5ed]">
          <div className="mx-auto flex max-w-[460px] flex-col items-center px-5 pt-9 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#cfe3d6] bg-[#eef5f0]">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4a875b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="text-[17px] font-extrabold text-[#2b2620]">
              トレーニングを{isUpdate ? "更新" : "記録"}しました
            </div>
            <div className="mt-2 rounded-full bg-[#eef5f0] px-3.5 py-1 text-[12.5px] font-extrabold text-[#34603f]">
              {fmtDate(date)}
            </div>
            {summary && <div className="mt-2.5 text-[12px] text-[#8a8172]">{summary}</div>}
            <div className="mt-7 flex w-full max-w-[330px] flex-col gap-2.5">
              <Link href="/workout/week/history" className="btn3d block rounded-xl py-3.5 text-center text-[14px] font-bold">
                記録の一覧へ
              </Link>
              <Link
                href={`/calendar?date=${date}`}
                className="block rounded-xl border-[1.5px] border-[#cfe0d4] bg-white py-3 text-center text-[13.5px] font-extrabold text-[#34603f]"
              >
                カレンダーへ
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (sp.done !== "1") redirect("/workout/week");

  const [streakDays, act, wk] = await Promise.all([
    getRecordStreak(),
    getTodayActivity(),
    getWeeklyTraining(),
  ]);
  const doneCount =
    (act.learned ? 1 : 0) + (act.recordedMeal ? 1 : 0) + (act.recordedWorkout ? 1 : 0);
  const nextLabel = wk.nextRecommended
    ? `次のおすすめ: ${wk.nextRecommended.name}`
    : "今週のおすすめは全部やりました";

  return (
    <WorkoutDoneCelebration
      streakDays={streakDays}
      doneCount={doneCount}
      nextLabel={nextLabel}
      fullScreen
      homeHref="/workout/week"
    />
  );
}
