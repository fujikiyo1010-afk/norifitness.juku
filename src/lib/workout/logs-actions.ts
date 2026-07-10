"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { jstTodayStr } from "@/lib/date/jst";
import { dayCount, type Intensity } from "@/lib/workout/logs";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

export type LoggedItemInput = {
  exerciseName: string;
  source?: "original" | "added";
  weightKg?: number | null;
  reps?: number | null;
  sets?: number | null;
};

/** メニューを開始(progress を作成し1日目を固定)。既に開始済みなら何もしない。 */
export async function startWorkout(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const menu = await getMyCurrentMenu();
  if (!menu) return { ok: false, message: "配布されたメニューがありません" };

  const { data: existing } = await supabase
    .from("user_workout_progress")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    // 既存進行があっても原本が変わっていれば menu_id だけ追随(日数は保持)
    await supabase
      .from("user_workout_progress")
      .update({ menu_id: menu.id })
      .eq("user_id", user.id);
    revalidatePath("/workout");
    revalidatePath("/workout/today");
    return { ok: true };
  }

  const { error } = await supabase.from("user_workout_progress").insert({
    user_id: user.id,
    menu_id: menu.id,
    current_day: 1,
    cycle_number: 1,
  });
  if (error) return { ok: false, message: `開始エラー: ${error.message}` };

  revalidatePath("/workout");
  revalidatePath("/workout/today");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 今日の実施を記録(完了/休養完了/スキップ)。
 * 1(周,日)=1行を upsert。done/rest_done は items を総入れ替え、skipped は items なし。
 * 完了後に progress を1日進める(周回ループ + 再配布の次1日目切替)。
 */
export async function completeWorkoutDay(input: {
  dayNumber: number;
  cycleNumber: number;
  intensity: Intensity;
  status: "done" | "rest_done" | "skipped";
  memo?: string | null;
  items?: LoggedItemInput[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const menu = await getMyCurrentMenu();
  if (!menu) return { ok: false, message: "メニューがありません" };

  const today = jstTodayStr();

  // ログ upsert(unique user_id,cycle_number,day_number)
  const { data: log, error: upErr } = await supabase
    .from("user_workout_logs")
    .upsert(
      {
        user_id: user.id,
        menu_id: menu.id,
        date: today,
        day_number: input.dayNumber,
        cycle_number: input.cycleNumber,
        intensity: input.intensity,
        status: input.status,
        memo: input.memo?.trim() || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,cycle_number,day_number" }
    )
    .select("id")
    .single();
  if (upErr || !log) return { ok: false, message: `保存エラー: ${upErr?.message}` };

  // items 総入れ替え(skipped は空)
  await supabase.from("user_workout_log_items").delete().eq("log_id", log.id);
  if (input.status !== "skipped") {
    const items = (input.items ?? [])
      .filter((it) => (it.exerciseName ?? "").trim().length > 0)
      .map((it, i) => ({
        log_id: log.id,
        exercise_name: it.exerciseName.trim(),
        source: it.source ?? "original",
        weight_kg: it.weightKg ?? null,
        reps: it.reps ?? null,
        sets: it.sets ?? null,
        sort_order: i,
      }));
    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from("user_workout_log_items")
        .insert(items);
      if (itemErr) return { ok: false, message: `種目の保存エラー: ${itemErr.message}` };
    }
  }

  // progress を1日進める(周回ループ + 再配布の次1日目切替)
  const { data: prog } = await supabase
    .from("user_workout_progress")
    .select("current_day, cycle_number, pending_menu_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (prog) {
    const total = dayCount(menu.cycles, input.intensity) || 7;
    let nextDay = (prog.current_day as number) + 1;
    let nextCycle = prog.cycle_number as number;
    let nextMenuId = menu.id;
    const pending = prog.pending_menu_id as string | null;
    if (nextDay > total) {
      nextDay = 1;
      nextCycle += 1;
      // 次の1日目=再配布の切替点
      if (pending) nextMenuId = pending;
    }
    await supabase
      .from("user_workout_progress")
      .update({
        current_day: nextDay,
        cycle_number: nextCycle,
        menu_id: nextMenuId,
        pending_menu_id: nextDay === 1 && pending ? null : pending,
      })
      .eq("user_id", user.id);
  }

  revalidatePath("/workout");
  revalidatePath("/workout/today");
  revalidatePath("/workout/history");
  revalidatePath("/");
  return { ok: true };
}
