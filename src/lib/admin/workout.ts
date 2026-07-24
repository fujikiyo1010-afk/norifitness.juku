import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMenuForAdmin } from "@/lib/workout/queries";
import { resolveDayMenu, INTENSITY_LABEL, type Intensity } from "@/lib/workout/logs-types";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { buildDoneExercises, type AdminDoneExercise, type LogItemRow, type PerSetRow } from "@/lib/admin/workout-sets";

/**
 * 管理: ユーザーハブ「トレ記録」タブ(M3・P5)のデータ(service role)。
 * 直近の実施ログを日別に、原本×実績の差分(やった/やらなかった/追加)付きで。
 */

export type AdminWorkoutDay = {
  date: string;
  dayLabel: string;
  performedDayLabel: string | null; // 予定と違う日をやった時の実施日ラベル(予定通りなら null)
  isSelfRest: boolean; // 本人が休養日に設定したか
  intensityLabel: string;
  status: "done" | "rest_done" | "skipped";
  doneNames: string[];
  notDoneNames: string[];
  addedNames: string[];
  doneExercises: AdminDoneExercise[]; // やった種目+セット別(重量×回数)
  totalVolume: number;
  memo: string | null;
};

export type AdminWorkoutHistory = {
  cycleNumber: number;
  thisMonthDone: number;
  totalDone: number;
  days: AdminWorkoutDay[];
};

export async function getWorkoutHistoryForUser(
  userId: string,
  limit = 30
): Promise<AdminWorkoutHistory> {
  const admin = createAdminClient();
  const empty: AdminWorkoutHistory = {
    cycleNumber: 1,
    thisMonthDone: 0,
    totalDone: 0,
    days: [],
  };

  const [{ data: logs }, { data: prog }, menu] = await Promise.all([
    admin
      .from("user_workout_logs")
      .select("id, date, day_number, performed_day_number, is_self_rest, is_custom, primary_target, intensity, status, memo")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit),
    admin
      .from("user_workout_progress")
      .select("cycle_number")
      .eq("user_id", userId)
      .maybeSingle(),
    getCurrentMenuForAdmin(userId),
  ]);

  const rows = (logs ?? []) as {
    id: string;
    date: string;
    day_number: number | null;
    performed_day_number: number | null;
    is_self_rest: boolean | null;
    is_custom: boolean | null;
    primary_target: string | null;
    intensity: Intensity;
    status: "done" | "rest_done" | "skipped";
    memo: string | null;
  }[];
  if (rows.length === 0)
    return { ...empty, cycleNumber: (prog?.cycle_number as number) ?? 1 };

  const logIds = rows.map((r) => r.id);
  const [{ data: itemRows }, { data: setRows }] = await Promise.all([
    admin
      .from("user_workout_log_items")
      .select("log_id, exercise_name, source, weight_kg, reps, sets, sort_order")
      .in("log_id", logIds),
    admin
      .from("user_custom_menu_sets")
      .select("log_id, exercise_name, exercise_order, set_number, weight_kg, reps")
      .in("log_id", logIds),
  ]);
  const doneByLog = new Map<string, string[]>();
  const addedByLog = new Map<string, string[]>();
  const itemsByLog = new Map<string, (LogItemRow & { sort_order: number | null })[]>();
  const setsByLog = new Map<string, PerSetRow[]>();
  for (const it of (itemRows ?? []) as {
    log_id: string;
    exercise_name: string;
    source: string;
    weight_kg: number | null;
    reps: number | null;
    sets: number | null;
    sort_order: number | null;
  }[]) {
    const name = cleanExerciseName(it.exercise_name);
    if (it.source === "added") {
      const a = addedByLog.get(it.log_id) ?? [];
      a.push(name);
      addedByLog.set(it.log_id, a);
    } else {
      const d = doneByLog.get(it.log_id) ?? [];
      d.push(name);
      doneByLog.set(it.log_id, d);
    }
    const arr = itemsByLog.get(it.log_id) ?? [];
    arr.push(it);
    itemsByLog.set(it.log_id, arr);
  }
  for (const s of (setRows ?? []) as ({ log_id: string } & PerSetRow)[]) {
    const arr = setsByLog.get(s.log_id) ?? [];
    arr.push(s);
    setsByLog.set(s.log_id, arr);
  }

  const days: AdminWorkoutDay[] = rows.map((r) => {
    const doneNames = doneByLog.get(r.id) ?? [];
    // 区別記録: 差分は「実際にやった日」のメニューで比較。
    const performedDay = r.performed_day_number ?? null;
    const effectiveDay = performedDay ?? r.day_number;
    const scheduledMenu = menu && r.day_number != null ? resolveDayMenu(menu.cycles, r.intensity, r.day_number) : null;
    const effectiveMenu = menu && effectiveDay != null ? resolveDayMenu(menu.cycles, r.intensity, effectiveDay) : null;
    const originalNames = (effectiveMenu?.種目 ?? [])
      .filter((e) => e.種目名)
      .map((e) => cleanExerciseName(e.種目名));
    const doneSet = new Set(doneNames);
    const orderedItems = (itemsByLog.get(r.id) ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const { exercises: doneExercises, totalVolume } = buildDoneExercises(
      orderedItems,
      setsByLog.get(r.id) ?? []
    );
    return {
      date: r.date,
      dayLabel: r.is_custom
        ? `じぶんメニュー${r.primary_target ? `（${r.primary_target}）` : ""}`
        : (scheduledMenu?.日 ?? (r.day_number != null ? `${r.day_number}日目` : "トレーニング")),
      performedDayLabel:
        performedDay != null ? (effectiveMenu?.日 ?? `${performedDay}日目`) : null,
      isSelfRest: !!r.is_self_rest,
      intensityLabel: INTENSITY_LABEL[r.intensity] ?? "中",
      status: r.status,
      doneNames,
      notDoneNames: originalNames.filter((n) => !doneSet.has(n)),
      addedNames: addedByLog.get(r.id) ?? [],
      doneExercises,
      totalVolume,
      memo: r.memo,
    };
  });

  const jstMonth = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
  const doneRows = days.filter((d) => d.status !== "skipped");
  return {
    cycleNumber: (prog?.cycle_number as number) ?? 1,
    thisMonthDone: doneRows.filter((d) => d.date.startsWith(jstMonth)).length,
    totalDone: doneRows.length,
    days,
  };
}
