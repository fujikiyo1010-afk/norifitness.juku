import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getFavorites, getCustomMenuDetail } from "@/lib/workout/custom-queries";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { resolveDayMenu, parseRepsSets } from "@/lib/workout/logs-types";
import { distMenuInfo } from "@/lib/workout/weekly";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import type { WorkoutCycles } from "@/lib/workout/types";
import { CustomBuilderClient } from "./CustomBuilderClient";

export const dynamic = "force-dynamic";

type BuilderInitial = {
  name: string;
  exercises: { name: string; videoUrl: string | null; sets: { kg: number | null; reps: number | null }[] }[];
};

/**
 * じぶんメニュー作成/編集(モック画面5→6→8)。
 *  - 引数なし: 1から組む(record)
 *  - ?record=id: 棚のメニューを元に今日やる(record)
 *  - ?edit=id: 棚のメニューを編集(edit・上書き保存)
 *  - ?copyDist=N: 配布メニューを複製して自分用に(種目単位→セット単位に展開・新規保存)
 */
export default async function CustomPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string; edit?: string; copyDist?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;

  const menuId = sp.edit || sp.record || null;
  const purpose = sp.edit ? "edit" : "record";

  const [favorites, detail, copyMenu] = await Promise.all([
    getFavorites(),
    menuId ? getCustomMenuDetail(menuId) : Promise.resolve(null),
    sp.copyDist ? getMyCurrentMenu() : Promise.resolve(null),
  ]);

  let initial: BuilderInitial | null = detail
    ? {
        name: detail.name,
        exercises: detail.exercises.map((ex) => ({
          name: ex.exerciseName,
          videoUrl: null,
          sets: ex.sets.map((s) => ({ kg: s.weightKg, reps: s.reps })),
        })),
      }
    : null;

  // 複製: 配布メニューの「◯回×◯セット」を セット行×各◯回(kgは原本にあれば/なければ空)に展開
  if (sp.copyDist && copyMenu) {
    const cycles = (copyMenu.cycles ?? []) as WorkoutCycles;
    const dayNum = Number(sp.copyDist);
    const dm = resolveDayMenu(cycles, "medium", dayNum);
    const info = distMenuInfo(cycles, dayNum);
    initial = {
      name: `${info.name}（自分用）`,
      exercises: (dm?.種目 ?? [])
        .filter((e) => e.種目名)
        .map((e) => {
          const rs = parseRepsSets(e.回数);
          const nSets = rs.sets && rs.sets > 0 ? rs.sets : 1;
          return {
            name: cleanExerciseName(e.種目名),
            videoUrl: null,
            sets: Array.from({ length: nSets }, () => ({ kg: null, reps: rs.reps })),
          };
        }),
    };
  }

  return (
    <>
      <MemberHeader
        title={purpose === "edit" ? "じぶんメニューを編集" : "自分のメニューを組む"}
        fallbackHref={purpose === "edit" ? "/workout/week/menus" : "/workout/week"}
      />
      <CustomBuilderClient
        initialFavorites={favorites}
        initial={initial}
        menuId={menuId}
        purpose={purpose}
      />
    </>
  );
}
