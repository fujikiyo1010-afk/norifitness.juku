import { redirect } from "next/navigation";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";
import { getRecordStreak } from "@/lib/member/record-streak";
import { getTodayActivity } from "@/lib/member/today-activity";
import { WorkoutDoneCelebration } from "@/app/workout/today/WorkoutDoneCelebration";

export const dynamic = "force-dynamic";

/**
 * 完了祝福(再設計: 表紙「完了」→ここ ?done=1 のみ)。
 * 記録UIは /workout/week/edit(セット表)→/workout/week/confirm(表紙)に移動済み。
 */
export default async function WeekDonePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;
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
