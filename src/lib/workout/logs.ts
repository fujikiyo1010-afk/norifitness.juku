import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import type { DayMenu, Exercise, WorkoutCycles } from "@/lib/workout/types";
import { resolveDayMenu, type Intensity, type LoggedItem } from "@/lib/workout/logs-types";

export { resolveDayMenu, dayCount } from "@/lib/workout/logs-types";
export type { Intensity, LoggedItem } from "@/lib/workout/logs-types";

/**
 * 筋トレ実施記録(P5)のデータ解決(server専用)。原本=user_workout_menu.cycles(参照のみ)。
 *  - 強度(small/medium/large) = cycles の段階(小/中/大)を選ぶ。
 *  - day_number = その段階の 週[day-1]。
 *  - 実績は user_workout_logs / _items に積む(原本は書き換えない)。
 * 純関数(resolveDayMenu/dayCount)と型は logs-types.ts(client安全)に集約。
 */

export type WorkoutProgress = {
  menuId: string | null;
  currentDay: number;
  cycleNumber: number;
  startedAt: string;
  pendingMenuId: string | null;
};

export async function getMyProgress(): Promise<WorkoutProgress | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_workout_progress")
    .select("menu_id, current_day, cycle_number, started_at, pending_menu_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    menuId: (data.menu_id as string | null) ?? null,
    currentDay: (data.current_day as number) ?? 1,
    cycleNumber: (data.cycle_number as number) ?? 1,
    startedAt: data.started_at as string,
    pendingMenuId: (data.pending_menu_id as string | null) ?? null,
  };
}

export type TodayWorkout = {
  hasMenu: boolean; // 原本メニューが配布されているか
  started: boolean; // 開始済みか
  menuId: string | null;
  cycles: WorkoutCycles | null;
  dayNumber: number;
  cycleNumber: number;
  dayMenu: DayMenu | null; // 今日の原本(medium 既定)
  todayLog: {
    id: string;
    intensity: Intensity;
    status: "done" | "rest_done" | "skipped";
    memo: string | null;
    completedAt: string | null;
    items: LoggedItem[];
  } | null;
  pending: boolean; // 再配布予告
};

/** 今日の実施記録に必要な一式を解決 */
export async function getTodayWorkout(): Promise<TodayWorkout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const menu = await getMyCurrentMenu();
  const empty: TodayWorkout = {
    hasMenu: !!menu,
    started: false,
    menuId: menu?.id ?? null,
    cycles: menu?.cycles ?? null,
    dayNumber: 1,
    cycleNumber: 1,
    dayMenu: menu ? resolveDayMenu(menu.cycles, "medium", 1) : null,
    todayLog: null,
    pending: false,
  };
  if (!user || !menu) return empty;

  const progress = await getMyProgress();
  if (!progress) return empty; // 未開始

  const dayNumber = progress.currentDay;
  const cycleNumber = progress.cycleNumber;

  // 今日(=現在の周・日)の既存ログ
  const { data: logRow } = await supabase
    .from("user_workout_logs")
    .select("id, intensity, status, memo, completed_at")
    .eq("user_id", user.id)
    .eq("cycle_number", cycleNumber)
    .eq("day_number", dayNumber)
    .maybeSingle();

  let todayLog: TodayWorkout["todayLog"] = null;
  if (logRow) {
    const { data: itemRows } = await supabase
      .from("user_workout_log_items")
      .select("exercise_name, source, weight_kg, reps, sets")
      .eq("log_id", logRow.id)
      .order("sort_order", { ascending: true });
    todayLog = {
      id: logRow.id as string,
      intensity: (logRow.intensity as Intensity) ?? "medium",
      status: logRow.status as "done" | "rest_done" | "skipped",
      memo: (logRow.memo as string | null) ?? null,
      completedAt: (logRow.completed_at as string | null) ?? null,
      items: ((itemRows ?? []) as Record<string, unknown>[]).map((r) => ({
        exerciseName: r.exercise_name as string,
        source: (r.source as "original" | "added") ?? "original",
        weightKg: (r.weight_kg as number | null) ?? null,
        reps: (r.reps as number | null) ?? null,
        sets: (r.sets as number | null) ?? null,
      })),
    };
  }

  const intensity = todayLog?.intensity ?? "medium";
  return {
    hasMenu: true,
    started: true,
    menuId: menu.id,
    cycles: menu.cycles,
    dayNumber,
    cycleNumber,
    dayMenu: resolveDayMenu(menu.cycles, intensity, dayNumber),
    todayLog,
    pending: !!progress.pendingMenuId,
  };
}

export type WorkoutHistoryRow = {
  date: string;
  dayNumber: number;
  cycleNumber: number;
  intensity: Intensity;
  status: "done" | "rest_done" | "skipped";
  addedCount: number;
  itemCount: number;
  hasMemo: boolean;
};

export type WorkoutHistory = {
  cycleNumber: number;
  thisWeek: number;
  thisMonth: number;
  totalDone: number;
  rows: WorkoutHistoryRow[];
};

/** トレ履歴(受講生・管理ハブ共通データ)。直近の実施ログをサマリー付きで。 */
export async function getMyWorkoutHistory(limit = 60): Promise<WorkoutHistory> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empty: WorkoutHistory = {
    cycleNumber: 1,
    thisWeek: 0,
    thisMonth: 0,
    totalDone: 0,
    rows: [],
  };
  if (!user) return empty;

  const [{ data: logs }, { data: prog }] = await Promise.all([
    supabase
      .from("user_workout_logs")
      .select("id, date, day_number, cycle_number, intensity, status, memo")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(limit),
    supabase
      .from("user_workout_progress")
      .select("cycle_number")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const rows0 = (logs ?? []) as {
    id: string;
    date: string;
    day_number: number;
    cycle_number: number;
    intensity: Intensity;
    status: "done" | "rest_done" | "skipped";
    memo: string | null;
  }[];

  // 追加種目数(source='added')を一括取得
  const addedByLog = new Map<string, number>();
  const itemsByLog = new Map<string, number>();
  if (rows0.length > 0) {
    const { data: items } = await supabase
      .from("user_workout_log_items")
      .select("log_id, source")
      .in(
        "log_id",
        rows0.map((r) => r.id)
      );
    for (const it of (items ?? []) as { log_id: string; source: string }[]) {
      itemsByLog.set(it.log_id, (itemsByLog.get(it.log_id) ?? 0) + 1);
      if (it.source === "added")
        addedByLog.set(it.log_id, (addedByLog.get(it.log_id) ?? 0) + 1);
    }
  }

  const rows: WorkoutHistoryRow[] = rows0.map((r) => ({
    date: r.date,
    dayNumber: r.day_number,
    cycleNumber: r.cycle_number,
    intensity: r.intensity,
    status: r.status,
    addedCount: addedByLog.get(r.id) ?? 0,
    itemCount: itemsByLog.get(r.id) ?? 0,
    hasMemo: !!r.memo,
  }));

  // 今週(JST月曜)/今月
  const jstOffset = 9 * 3600 * 1000;
  const now = new Date();
  const jstNow = new Date(now.getTime() + jstOffset);
  const dow = (jstNow.getUTCDay() + 6) % 7;
  const monday = new Date(jstNow);
  monday.setUTCDate(jstNow.getUTCDate() - dow);
  const mondayStr = monday.toISOString().slice(0, 10);
  const monthStr = jstNow.toISOString().slice(0, 7);

  const doneRows = rows.filter((r) => r.status === "done" || r.status === "rest_done");
  return {
    cycleNumber: (prog?.cycle_number as number | undefined) ?? 1,
    thisWeek: doneRows.filter((r) => r.date >= mondayStr).length,
    thisMonth: doneRows.filter((r) => r.date.startsWith(monthStr)).length,
    totalDone: doneRows.length,
    rows,
  };
}

/** 原本の Exercise[] を実績アイテムの初期値へ(表示・保存用) */
export function originalToItems(exercises: Exercise[]): LoggedItem[] {
  return (exercises ?? [])
    .filter((e) => e.種目名)
    .map((e) => ({
      exerciseName: e.種目名,
      source: "original" as const,
      weightKg: null,
      reps: null,
      sets: null,
    }));
}
