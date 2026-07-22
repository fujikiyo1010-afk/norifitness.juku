"use server";

/**
 * 週間プール改修(2026-07-22)の書き込み経路。案1＋きよむ3条件。
 *
 * 【条件1】プール経路の行は cycle_number=NULL で書く(unique(user,cycle,day_number)を素通り)。
 *          週は date から導出。既存の一本道行(cycle_number 有り)は不変。
 * 【条件2】保存は常に insert。当日修正は行id指定の update(upsertは使わない)。
 *          1日複数実施は insert で並存(表示は最後の1つ=決定⑤)。
 * 【条件3】既存 completeWorkoutDay(logs-actions.ts) は非ゲート利用者(従来の一本道)用に温存。
 *          全公開時に退役する(このプール経路へ一本化)。
 *
 * 配布メニュー実施 = recordDistWorkout(種目単位・既存V2記録UIから)。
 * じぶんメニュー実施 = recordCustomWorkout(セット単位・log_items種目単位も併記=カレンダー/管理の集約用)。
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { partByExerciseName } from "@/lib/workout/video-master";
import { jstTodayStr } from "@/lib/date/jst";
import { distMenuInfo } from "@/lib/workout/weekly";
import type { WorkoutCycles } from "@/lib/workout/types";
import type { Intensity, LoggedItem } from "@/lib/workout/logs-types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

export type SetInput = { weightKg: number | null; reps: number | null };
export type CustomExerciseInput = { exerciseName: string; sets: SetInput[] };

/** 選んだ種目の主部位で多数決(§9・主部位1つ)。該当なしは「全身」。 */
function dominantTarget(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) {
    const p = partByExerciseName(n);
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [p, n] of counts) if (n > bestN) { best = p; bestN = n; }
  return best ?? "全身";
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// =====================================================================
// 配布メニュー実施(pool・種目単位)
// =====================================================================

/**
 * 配布メニューを「今日やった」として日付キーで記録(条件1/2)。
 * editLogId 指定時は当日修正(行id update)。未指定は insert。
 */
export async function recordDistWorkout(input: {
  dayNumber: number; // やった配布メニューの番号(グリッドの letter 表示用)
  intensity: Intensity;
  items: LoggedItem[]; // 種目単位(既存V2の記録)
  memo?: string | null;
  status?: "done" | "rest_done";
  editLogId?: string | null;
}): Promise<ActionResult<{ logId: string }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  const menu = await getMyCurrentMenu(user.id);
  if (!menu) return { ok: false, message: "メニューがありません" };

  const cycles = (menu.cycles ?? []) as WorkoutCycles;
  const info = distMenuInfo(cycles, input.dayNumber);
  const status = input.status ?? "done";
  const items = (input.items ?? []).filter((it) => (it.exerciseName ?? "").trim().length > 0);

  const logFields = {
    user_id: user.id,
    menu_id: menu.id,
    date: jstTodayStr(),
    day_number: input.dayNumber,
    cycle_number: null as number | null, // 条件1: プール行は NULL
    intensity: input.intensity,
    status,
    memo: input.memo?.trim() || null,
    is_custom: false,
    custom_menu_id: null,
    primary_target: info.target === "休" || info.target === "パーソナル" ? null : info.target,
    completed_at: new Date().toISOString(),
  };

  let logId: string;
  if (input.editLogId) {
    // 条件2: 当日修正は行id指定の update(date は書き換えない)
    const { data, error } = await supabase
      .from("user_workout_logs")
      .update({ ...logFields, date: undefined })
      .eq("id", input.editLogId)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: `保存エラー: ${error?.message}` };
    logId = data.id as string;
    await supabase.from("user_workout_log_items").delete().eq("log_id", logId);
  } else {
    const { data, error } = await supabase
      .from("user_workout_logs")
      .insert(logFields)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: `保存エラー: ${error?.message}` };
    logId = data.id as string;
  }

  if (status !== "rest_done" && items.length > 0) {
    const rows = items.map((it, i) => ({
      log_id: logId,
      exercise_name: it.exerciseName.trim(),
      source: it.source ?? "original",
      weight_kg: it.weightKg ?? null,
      reps: it.reps ?? null,
      sets: it.sets ?? null,
      sort_order: i,
    }));
    const { error } = await supabase.from("user_workout_log_items").insert(rows);
    if (error) return { ok: false, message: `種目の保存エラー: ${error.message}` };
  }

  revalidateWorkout();
  return { ok: true, data: { logId } };
}

// =====================================================================
// じぶんメニュー実施(セット単位)
// =====================================================================

/**
 * じぶんメニューを記録。log_items(種目単位)＋user_custom_menu_sets(セット単位)を両方書く。
 * saveAsName 指定時はテンプレも作成(棚に保存)。editLogId で当日修正。
 * kg・回が入ったセットのみ実績(§6・空行は保存しない)。
 */
export async function recordCustomWorkout(input: {
  exercises: CustomExerciseInput[];
  memo?: string | null;
  saveAsName?: string | null; // 指定=じぶんメニューとして保存
  fromMenuId?: string | null; // 元にしたじぶんメニュー(あれば)
  editLogId?: string | null;
}): Promise<ActionResult<{ logId: string }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  // 実績セットのみ(kg か 回 が入っている)
  const exercises = input.exercises
    .map((ex) => ({
      exerciseName: ex.exerciseName.trim(),
      sets: ex.sets.filter((s) => s.weightKg != null || s.reps != null),
    }))
    .filter((ex) => ex.exerciseName.length > 0 && ex.sets.length > 0);
  if (exercises.length === 0) return { ok: false, message: "記録するセットがありません" };

  const target = dominantTarget(exercises.map((e) => e.exerciseName));

  // 保存(棚)= saveAsName ありかつ新規保存時にテンプレ作成
  let savedMenuId: string | null = input.fromMenuId ?? null;
  if (input.saveAsName && input.saveAsName.trim()) {
    const menuId = await createCustomMenuInternal(supabase, user.id, input.saveAsName.trim(), target, exercises);
    if (menuId) savedMenuId = menuId;
  }

  const menu = await getMyCurrentMenu(user.id);
  const logFields = {
    user_id: user.id,
    menu_id: menu?.id ?? null,
    date: jstTodayStr(),
    day_number: null as number | null, // じぶんメニューは配布日に紐づかない
    cycle_number: null as number | null, // 条件1
    intensity: "medium" as Intensity,
    status: "done" as const,
    memo: input.memo?.trim() || null,
    is_custom: true,
    custom_menu_id: savedMenuId,
    primary_target: target,
    completed_at: new Date().toISOString(),
  };

  let logId: string;
  if (input.editLogId) {
    const { data, error } = await supabase
      .from("user_workout_logs")
      .update({ ...logFields, date: undefined })
      .eq("id", input.editLogId)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: `保存エラー: ${error?.message}` };
    logId = data.id as string;
    await supabase.from("user_workout_log_items").delete().eq("log_id", logId);
    await supabase.from("user_custom_menu_sets").delete().eq("log_id", logId);
  } else {
    const { data, error } = await supabase
      .from("user_workout_logs")
      .insert(logFields)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: `保存エラー: ${error?.message}` };
    logId = data.id as string;
  }

  // log_items(種目単位・種目数/総ボリューム集約用)
  const itemRows = exercises.map((ex, i) => ({
    log_id: logId,
    exercise_name: ex.exerciseName,
    source: "added",
    weight_kg: null,
    reps: null,
    sets: ex.sets.length,
    sort_order: i,
  }));
  await supabase.from("user_workout_log_items").insert(itemRows);

  // user_custom_menu_sets(セット単位・実績)
  const setRows = exercises.flatMap((ex, ei) =>
    ex.sets.map((s, si) => ({
      user_id: user.id,
      custom_menu_id: savedMenuId,
      log_id: logId,
      exercise_name: ex.exerciseName,
      exercise_order: ei,
      set_number: si + 1,
      weight_kg: s.weightKg,
      reps: s.reps,
    }))
  );
  const { error: setErr } = await supabase.from("user_custom_menu_sets").insert(setRows);
  if (setErr) return { ok: false, message: `セットの保存エラー: ${setErr.message}` };

  revalidateWorkout();
  return { ok: true, data: { logId } };
}

// =====================================================================
// じぶんメニュー棚 CRUD
// =====================================================================

async function createCustomMenuInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
  target: string,
  exercises: CustomExerciseInput[]
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_custom_menus")
    .insert({ user_id: userId, name, primary_target: target })
    .select("id")
    .single();
  if (error || !data) return null;
  const menuId = data.id as string;
  const rows = exercises.flatMap((ex, ei) =>
    (ex.sets.length > 0 ? ex.sets : [{ weightKg: null, reps: null }]).map((s, si) => ({
      user_id: userId,
      custom_menu_id: menuId,
      log_id: null,
      exercise_name: ex.exerciseName.trim(),
      exercise_order: ei,
      set_number: si + 1,
      weight_kg: s.weightKg,
      reps: s.reps,
    }))
  );
  if (rows.length > 0) await supabase.from("user_custom_menu_sets").insert(rows);
  return menuId;
}

/** じぶんメニューを新規保存(実施なし・棚だけ) */
export async function saveCustomMenu(input: {
  name: string;
  exercises: CustomExerciseInput[];
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "名前を入力してください" };
  const exercises = input.exercises.filter((e) => e.exerciseName.trim());
  if (exercises.length === 0) return { ok: false, message: "種目がありません" };
  const target = dominantTarget(exercises.map((e) => e.exerciseName));
  const id = await createCustomMenuInternal(supabase, user.id, name, target, exercises);
  if (!id) return { ok: false, message: "保存に失敗しました" };
  revalidateWorkout();
  return { ok: true, data: { id } };
}

/** じぶんメニューを編集(名前＋構成を差し替え) */
export async function updateCustomMenu(input: {
  id: string;
  name: string;
  exercises: CustomExerciseInput[];
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "名前を入力してください" };
  const exercises = input.exercises.filter((e) => e.exerciseName.trim());
  const target = dominantTarget(exercises.map((e) => e.exerciseName));
  const { error: upErr } = await supabase
    .from("user_custom_menus")
    .update({ name, primary_target: target })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (upErr) return { ok: false, message: `更新エラー: ${upErr.message}` };
  // テンプレ構成(log_id NULL)だけ差し替え。実施行(log_id 有り)は温存。
  await supabase
    .from("user_custom_menu_sets")
    .delete()
    .eq("custom_menu_id", input.id)
    .is("log_id", null);
  const rows = exercises.flatMap((ex, ei) =>
    (ex.sets.length > 0 ? ex.sets : [{ weightKg: null, reps: null }]).map((s, si) => ({
      user_id: user.id,
      custom_menu_id: input.id,
      log_id: null,
      exercise_name: ex.exerciseName.trim(),
      exercise_order: ei,
      set_number: si + 1,
      weight_kg: s.weightKg,
      reps: s.reps,
    }))
  );
  if (rows.length > 0) await supabase.from("user_custom_menu_sets").insert(rows);
  revalidateWorkout();
  return { ok: true };
}

/**
 * じぶんメニューを削除。テンプレ構成(log_id NULL)は消すが、実施行(log_id 有り)は残す
 * (custom_menu_id は FK on delete set null で自動 NULL 化=過去の実績は不変・画面11の約束)。
 */
export async function deleteCustomMenu(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  await supabase
    .from("user_custom_menu_sets")
    .delete()
    .eq("custom_menu_id", id)
    .is("log_id", null);
  const { error } = await supabase
    .from("user_custom_menus")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: `削除エラー: ${error.message}` };
  revalidateWorkout();
  return { ok: true };
}

// =====================================================================
// お気に入り種目(リボン)
// =====================================================================

export async function toggleFavorite(exerciseName: string): Promise<ActionResult<{ on: boolean }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  const name = exerciseName.trim();
  const { data: existing } = await supabase
    .from("user_favorite_exercises")
    .select("exercise_name")
    .eq("user_id", user.id)
    .eq("exercise_name", name)
    .maybeSingle();
  if (existing) {
    await supabase.from("user_favorite_exercises").delete().eq("user_id", user.id).eq("exercise_name", name);
    return { ok: true, data: { on: false } };
  }
  await supabase.from("user_favorite_exercises").insert({ user_id: user.id, exercise_name: name });
  return { ok: true, data: { on: true } };
}

function revalidateWorkout() {
  revalidatePath("/");
  revalidatePath("/workout/week");
  revalidatePath("/workout/history");
}
