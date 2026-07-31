import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getEditorInitial } from "@/lib/workout/pool-detail";
import { getFavorites } from "@/lib/workout/custom-queries";
import { jstTodayStr } from "@/lib/date/jst";
import { SetTableClient } from "./SetTableClient";
import { FlowLeaveGuard } from "../FlowLeaveGuard";
import type { DraftExercise } from "../draft";

export const dynamic = "force-dynamic";

/** 戻り先(§3・来た入口へ)。from パラメータで分岐、既定はメイン。 */
const FROM_HREF: Record<string, string> = {
  select: "/workout/week/select",
  menus: "/workout/week/menus",
  last: "/workout/week/last",
  main: "/workout/week",
  list: "/workout/week/history", // 過去日記録の一覧(バックデート)から来た
};

/** 対象日(バックデート)を検証。YYYY-MM-DD かつ 今日以前のみ採用。不正/未来は null(=今日扱い)。 */
function sanitizeDate(d: string | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d <= jstTodayStr() ? d : null;
}

/**
 * セット表(§2-4・全経路の着地点)。
 *  ?day=N 配布そのまま / ?menu=id 棚じぶん / ?copyDist=N 複製 / ?last=logId 先週再実施 / ?edit=logId 当日修正 / 無=1から
 *  ?from=select|menus|last|main 戻り先 / ?resume=1 「←修正する」で戻ってきた(ドラフト復元)
 */
export default async function WeekEditPage({
  searchParams,
}: {
  searchParams: Promise<{
    day?: string;
    menu?: string;
    copyDist?: string;
    last?: string;
    edit?: string;
    from?: string;
    resume?: string;
    date?: string;
  }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;
  // 過去日記録(バックデート): 対象日。無ければ今日。todayKey(下書き名前空間)も対象日で分離。
  const targetDate = sanitizeDate(sp.date);
  const flowKey = targetDate ?? jstTodayStr();

  const [initial, favorites] = await Promise.all([
    getEditorInitial(sp),
    getFavorites(),
  ]);
  if (!initial) redirect("/workout/week");

  const exercises: DraftExercise[] = initial.exercises.map((e) => ({
    name: e.name,
    source: e.source,
    videoUrl: e.videoUrl,
    sets: e.sets,
    baseSets: e.baseSets,
  }));

  const backHref = FROM_HREF[sp.from ?? ""] ?? "/workout/week";

  return (
    <>
      <MemberHeader title={initial.menuName} fallbackHref={backHref} />
      {/* ②-B: 編集中の離脱時に破棄確認。戻り先=来た入口。 */}
      <FlowLeaveGuard active backHref={backHref} todayKey={flowKey} />
      <SetTableClient
        kind={initial.kind}
        dayNumber={initial.dayNumber}
        menuName={initial.menuName}
        editLogId={initial.editLogId}
        todayKey={flowKey}
        targetDate={targetDate}
        initialExercises={exercises}
        initialFavorites={favorites}
        initialIntensity={initial.intensity}
        stageOptions={initial.stageOptions}
        resume={sp.resume === "1"}
      />
    </>
  );
}
