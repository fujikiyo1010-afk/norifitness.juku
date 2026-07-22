import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { resolveDayMenu, parseRepsSets } from "@/lib/workout/logs-types";
import { distMenuInfo } from "@/lib/workout/weekly";
import { cleanExerciseName, cleanReps } from "@/lib/workout/menu-display";
import { resolveExerciseVideo, lookupVideoByName } from "@/lib/workout/video-master";
import type { WorkoutCycles } from "@/lib/workout/types";
import { WeekMenuDetail, type DetailExercise } from "./WeekMenuDetail";

export const dynamic = "force-dynamic";

/** 配布メニュー詳細(モック画面4)。 */
export default async function WeekMenuDetailPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const { day } = await params;
  const dayNum = Number(day);
  if (!Number.isFinite(dayNum) || dayNum < 1) redirect("/workout/week/select");

  const menu = await getMyCurrentMenu();
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;
  const dm = resolveDayMenu(cycles, "medium", dayNum);
  const info = distMenuInfo(cycles, dayNum);

  const exercises: DetailExercise[] = (dm?.種目 ?? [])
    .filter((e) => e.種目名)
    .map((e) => {
      const rs = parseRepsSets(e.回数);
      return {
        name: cleanExerciseName(e.種目名),
        reps:
          rs.reps != null
            ? `${rs.reps}回${rs.sets != null ? ` × ${rs.sets}` : ""}`
            : cleanReps(e.回数),
        videoUrl: resolveExerciseVideo(e) ?? lookupVideoByName(e.種目名),
      };
    });

  return (
    <>
      <MemberHeader title={info.name} fallbackHref="/workout/week/select" />
      <WeekMenuDetail day={dayNum} name={info.name} exercises={exercises} />
    </>
  );
}
