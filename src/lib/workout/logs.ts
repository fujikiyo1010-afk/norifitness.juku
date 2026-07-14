import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { jstTodayStr } from "@/lib/date/jst";
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

export async function getMyProgress(
  userId?: string
): Promise<WorkoutProgress | null> {
  const supabase = await createClient();
  // S2-C: 呼び出し元が user を持っていれば getUser(往復)を省く(未指定なら従来どおり)。
  let uid = userId;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }
  const { data } = await supabase
    .from("user_workout_progress")
    .select("menu_id, current_day, cycle_number, started_at, pending_menu_id")
    .eq("user_id", uid)
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
  completedToday: boolean; // 細2: 今日(JST)に既に記録済み(=次の日の開始は翌日から)
  progress: WorkoutProgress | null; // S2-C: 完了演出の「明日は」ラベル等で再取得せず使い回す
};

/** 今日の実施記録に必要な一式を解決 */
export async function getTodayWorkout(): Promise<TodayWorkout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const menu = await getMyCurrentMenu(user?.id); // S2-C: user引き回し(null時は内部でgetUser=従来どおり)
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
    completedToday: false,
    progress: null,
  };
  if (!user || !menu) return empty;

  const progress = await getMyProgress(user.id); // S2-C: user引き回し
  if (!progress) return empty; // 未開始

  const today = jstTodayStr();

  // 細2: まず「今日(JST)のログ」を探す。あればその日を表示し翌日開始をブロック(current_dayは進んでいてよい)。
  // 新2: date=today が万一2行あっても壊れないよう order+limit(1)。error は握りつぶさない。
  const { data: todayRows, error: todayErr } = await supabase
    .from("user_workout_logs")
    .select(
      "id, day_number, cycle_number, intensity, status, memo, completed_at, user_workout_log_items(exercise_name, source, weight_kg, reps, sets, sort_order)"
    )
    .eq("user_id", user.id)
    .eq("date", today)
    .order("completed_at", { ascending: false })
    .limit(1);
  if (todayErr) throw new Error(`今日のトレ記録の取得に失敗しました: ${todayErr.message}`);
  const todayRow = todayRows?.[0] ?? null;

  const completedToday = !!todayRow;
  let dayNumber: number;
  let cycleNumber: number;
  // S2-D: 品目は user_workout_logs にネストして取得済み(別便のitemsクエリを廃止)。
  type NestedItem = {
    exercise_name: string;
    source: string;
    weight_kg: number | null;
    reps: number | null;
    sets: number | null;
    sort_order: number | null;
  };
  let logRow:
    | {
        id: string;
        intensity: string;
        status: string;
        memo: string | null;
        completed_at: string | null;
        user_workout_log_items: NestedItem[] | null;
      }
    | null;
  if (todayRow) {
    dayNumber = todayRow.day_number as number;
    cycleNumber = todayRow.cycle_number as number;
    logRow = todayRow as unknown as typeof logRow;
  } else {
    dayNumber = progress.currentDay;
    cycleNumber = progress.cycleNumber;
    const { data } = await supabase
      .from("user_workout_logs")
      .select(
        "id, intensity, status, memo, completed_at, user_workout_log_items(exercise_name, source, weight_kg, reps, sets, sort_order)"
      )
      .eq("user_id", user.id)
      .eq("cycle_number", cycleNumber)
      .eq("day_number", dayNumber)
      .maybeSingle();
    logRow = data as unknown as typeof logRow;
  }

  let todayLog: TodayWorkout["todayLog"] = null;
  if (logRow) {
    const itemRows = (logRow.user_workout_log_items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    todayLog = {
      id: logRow.id as string,
      intensity: (logRow.intensity as Intensity) ?? "medium",
      status: logRow.status as "done" | "rest_done" | "skipped",
      memo: (logRow.memo as string | null) ?? null,
      completedAt: (logRow.completed_at as string | null) ?? null,
      items: itemRows.map((r) => ({
        exerciseName: r.exercise_name,
        source: (r.source as "original" | "added") ?? "original",
        weightKg: r.weight_kg ?? null,
        reps: r.reps ?? null,
        sets: r.sets ?? null,
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
    completedToday,
    progress,
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
  /** 予定と違う日をやった時、実際に実施した日(予定通りなら null)。 */
  performedDayNumber: number | null;
  /** 本人が休養日に設定したか(のり予定の休養日=false)。 */
  isSelfRest: boolean;
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

  // S2-D: 親(user_workout_logs)→子(items)の2往復を、ネストselectで1往復に。
  //   子は RLS「uw_log_items: self all」で本人が読めるため空落ちしない。件数だけ使う。
  const [{ data: logs }, { data: prog }] = await Promise.all([
    supabase
      .from("user_workout_logs")
      .select(
        "id, date, day_number, cycle_number, intensity, status, memo, performed_day_number, is_self_rest, user_workout_log_items(source)"
      )
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
    performed_day_number: number | null;
    is_self_rest: boolean | null;
    user_workout_log_items: { source: string }[] | null;
  }[];

  const rows: WorkoutHistoryRow[] = rows0.map((r) => {
    const items = r.user_workout_log_items ?? [];
    return {
      date: r.date,
      dayNumber: r.day_number,
      cycleNumber: r.cycle_number,
      intensity: r.intensity,
      status: r.status,
      addedCount: items.filter((i) => i.source === "added").length,
      itemCount: items.length,
      hasMemo: !!r.memo,
      performedDayNumber: r.performed_day_number ?? null,
      isSelfRest: !!r.is_self_rest,
    };
  });

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
