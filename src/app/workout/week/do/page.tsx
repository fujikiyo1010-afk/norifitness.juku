import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { resolveDayMenu, parseRepsSets } from "@/lib/workout/logs-types";
import { distMenuInfo, getWeeklyTraining } from "@/lib/workout/weekly";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { resolveExerciseVideo, lookupVideoByName } from "@/lib/workout/video-master";
import { getRecordStreak } from "@/lib/member/record-streak";
import { getTodayActivity } from "@/lib/member/today-activity";
import type { WorkoutCycles } from "@/lib/workout/types";
import { WorkoutDoneCelebration } from "@/app/workout/today/WorkoutDoneCelebration";
import { WeekDoClient, type DoExercise } from "./WeekDoClient";

export const dynamic = "force-dynamic";

/** 実施(モック画面4→記録)。day=配布実施 / rest=休養日 / done=完了祝福。 */
export default async function WeekDoPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; rest?: string; done?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;

  // 完了祝福(既存資産を流用・フルスクリーン)
  if (sp.done === "1") {
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

  // 休養日
  if (sp.rest === "1") {
    return (
      <>
        <MemberHeader title="休養日にする" fallbackHref="/workout/week/select" />
        <WeekDoClient mode="rest" day={null} menuName="休養日" initial={[]} />
      </>
    );
  }

  // 配布メニュー実施
  const dayNum = Number(sp.day);
  if (!Number.isFinite(dayNum) || dayNum < 1) redirect("/workout/week");
  const menu = await getMyCurrentMenu();
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;
  const dm = resolveDayMenu(cycles, "medium", dayNum);
  const info = distMenuInfo(cycles, dayNum);
  const initial: DoExercise[] = (dm?.種目 ?? [])
    .filter((e) => e.種目名)
    .map((e) => {
      const rs = parseRepsSets(e.回数);
      return {
        name: cleanExerciseName(e.種目名),
        reps: rs.reps,
        sets: rs.sets,
        videoUrl: resolveExerciseVideo(e) ?? lookupVideoByName(e.種目名),
      };
    });

  return (
    <>
      <MemberHeader title="今日のトレを記録" fallbackHref="/workout/week" />
      <WeekDoClient mode="dist" day={dayNum} menuName={info.name} initial={initial} />
    </>
  );
}
