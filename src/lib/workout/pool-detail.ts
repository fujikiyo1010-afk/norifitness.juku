/**
 * 週間トレ再設計(2026-07-23): セット表エディタの初期値解決 + グリッド下見モーダルの詳細取得。
 * 破壊なし・読むだけ。既存ログ(custom_menu_sets が無い旧配布/旧じぶん)は log_items から復元する
 * フォールバックを持つ(近藤さん等の過去データが先週再実施・当日修正・モーダルで従来どおり見えるため)。
 */
import { createClient } from "@/lib/supabase/server";
import { jstTodayStr } from "@/lib/date/jst";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { resolveDayMenu, parseRepsSets } from "@/lib/workout/logs-types";
import { distMenuInfo } from "@/lib/workout/weekly";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { resolveExerciseVideo, lookupVideoByName } from "@/lib/workout/video-master";
import type { WorkoutCycles } from "@/lib/workout/types";

export type EditorSet = { kg: number | null; reps: number | null };
export type EditorExercise = {
  name: string;
  videoUrl: string | null;
  source: "original" | "added";
  sets: EditorSet[];
  baseSets: EditorSet[] | null; // のり初期値(紫差分の基準)。通常色経路は null。
};
export type EditorInitial = {
  kind: "dist" | "custom";
  dayNumber: number | null;
  menuName: string;
  editLogId: string | null;
  exercises: EditorExercise[];
};

type SupaClient = Awaited<ReturnType<typeof createClient>>;

/** 配布メニュー1日 → のり初期値の EditorExercise[](source=original, baseSets=自分自身のコピー) */
function distInitialExercises(cycles: WorkoutCycles, day: number): EditorExercise[] {
  const dm = resolveDayMenu(cycles, "medium", day);
  return (dm?.種目 ?? [])
    .filter((e) => e.種目名)
    .map((e) => {
      const rs = parseRepsSets(e.回数);
      const n = rs.sets && rs.sets > 0 ? rs.sets : 1;
      const sets: EditorSet[] = Array.from({ length: n }, () => ({ kg: null, reps: rs.reps }));
      return {
        name: cleanExerciseName(e.種目名),
        videoUrl: resolveExerciseVideo(e) ?? lookupVideoByName(e.種目名),
        source: "original" as const,
        sets: sets.map((s) => ({ ...s })),
        baseSets: sets.map((s) => ({ ...s })), // のり初期値=基準(紫はここからの変更)
      };
    });
}

/** ログの実績を EditorExercise[] に復元。custom_menu_sets 優先・無ければ log_items から展開。 */
async function loadLogExercises(
  supabase: SupaClient,
  logId: string,
  withBaseFromDistDay: number | null,
  cycles: WorkoutCycles
): Promise<EditorExercise[]> {
  // のり基準(当日修正の配布など)。null なら通常色。
  const baseByName = new Map<string, EditorSet[]>();
  if (withBaseFromDistDay != null) {
    for (const e of distInitialExercises(cycles, withBaseFromDistDay)) {
      baseByName.set(e.name, e.sets.map((s) => ({ ...s })));
    }
  }

  const [{ data: sets }, { data: items }] = await Promise.all([
    supabase
      .from("user_custom_menu_sets")
      .select("exercise_name, exercise_order, set_number, weight_kg, reps")
      .eq("log_id", logId)
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true }),
    supabase
      .from("user_workout_log_items")
      .select("exercise_name, source, reps, sets, sort_order")
      .eq("log_id", logId)
      .order("sort_order", { ascending: true }),
  ]);

  const itemRows = (items ?? []) as {
    exercise_name: string;
    source: string;
    reps: number | null;
    sets: number | null;
    sort_order: number | null;
  }[];
  const sourceByName = new Map<string, "original" | "added">();
  for (const it of itemRows)
    sourceByName.set(cleanExerciseName(it.exercise_name), it.source === "added" ? "added" : "original");

  const setRows = (sets ?? []) as {
    exercise_name: string;
    exercise_order: number;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
  }[];

  const out: EditorExercise[] = [];
  if (setRows.length > 0) {
    // custom_menu_sets から(セット別)
    const byEx = new Map<string, EditorSet[]>();
    const order: string[] = [];
    for (const r of setRows) {
      const nm = cleanExerciseName(r.exercise_name);
      if (!byEx.has(nm)) {
        byEx.set(nm, []);
        order.push(nm);
      }
      byEx.get(nm)!.push({ kg: r.weight_kg, reps: r.reps });
    }
    for (const nm of order) {
      out.push({
        name: nm,
        videoUrl: lookupVideoByName(nm),
        source: sourceByName.get(nm) ?? "original",
        sets: byEx.get(nm)!,
        baseSets: baseByName.get(nm) ?? null,
      });
    }
  } else {
    // 旧ログ: log_items(種目単位)から展開(reps を各セットに複製・kg は null)
    for (const it of itemRows) {
      const nm = cleanExerciseName(it.exercise_name);
      const n = it.sets && it.sets > 0 ? it.sets : 1;
      out.push({
        name: nm,
        videoUrl: lookupVideoByName(nm),
        source: it.source === "added" ? "added" : "original",
        sets: Array.from({ length: n }, () => ({ kg: null, reps: it.reps })),
        baseSets: baseByName.get(nm) ?? null,
      });
    }
  }
  return out;
}

/**
 * セット表の初期値解決(edit page server)。
 *  day=N: 配布そのまま(のり初期値・紫基準あり)
 *  menu=id: 棚じぶん(保存構成・通常色)
 *  copyDist=N: 配布を複製→じぶん(通常色)
 *  last=logId: 先週再実施(実績初期値・通常色)
 *  edit=logId: 当日修正(実績初期値・配布なら紫基準あり・行id update)
 *  none: 1から(空・通常色)
 */
export async function getEditorInitial(params: {
  day?: string;
  menu?: string;
  copyDist?: string;
  last?: string;
  edit?: string;
}): Promise<EditorInitial | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const menu = await getMyCurrentMenu(user.id);
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;

  // 当日修正
  if (params.edit) {
    const { data: log } = await supabase
      .from("user_workout_logs")
      .select("id, day_number, is_custom, primary_target")
      .eq("id", params.edit)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!log) return null;
    const isCustom = !!log.is_custom;
    const dayNumber = (log.day_number as number | null) ?? null;
    const exercises = await loadLogExercises(
      supabase,
      params.edit,
      isCustom ? null : dayNumber,
      cycles
    );
    const menuName = isCustom
      ? "じぶんメニュー"
      : distMenuInfo(cycles, dayNumber ?? 0).name;
    return { kind: isCustom ? "custom" : "dist", dayNumber, menuName, editLogId: params.edit, exercises };
  }

  // 先週再実施
  if (params.last) {
    const { data: log } = await supabase
      .from("user_workout_logs")
      .select("id, day_number, is_custom, primary_target")
      .eq("id", params.last)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!log) return null;
    const isCustom = !!log.is_custom;
    const dayNumber = (log.day_number as number | null) ?? null;
    const exercises = await loadLogExercises(supabase, params.last, null, cycles); // 通常色(base=実績)
    const menuName = isCustom
      ? (log.primary_target ? `${log.primary_target}の日` : "じぶんメニュー")
      : distMenuInfo(cycles, dayNumber ?? 0).name;
    return { kind: isCustom ? "custom" : "dist", dayNumber, menuName, editLogId: null, exercises };
  }

  // 棚じぶん
  if (params.menu) {
    const { data: m } = await supabase
      .from("user_custom_menus")
      .select("id, name")
      .eq("id", params.menu)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!m) return null;
    const { data: sets } = await supabase
      .from("user_custom_menu_sets")
      .select("exercise_name, exercise_order, set_number, weight_kg, reps")
      .eq("custom_menu_id", params.menu)
      .is("log_id", null)
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true });
    const byEx = new Map<string, EditorSet[]>();
    const order: string[] = [];
    for (const r of (sets ?? []) as {
      exercise_name: string;
      weight_kg: number | null;
      reps: number | null;
    }[]) {
      const nm = cleanExerciseName(r.exercise_name);
      if (!byEx.has(nm)) {
        byEx.set(nm, []);
        order.push(nm);
      }
      byEx.get(nm)!.push({ kg: r.weight_kg, reps: r.reps });
    }
    return {
      kind: "custom",
      dayNumber: null,
      menuName: (m.name as string) || "じぶんメニュー",
      editLogId: null,
      exercises: order.map((nm) => ({
        name: nm,
        videoUrl: lookupVideoByName(nm),
        source: "added" as const,
        sets: byEx.get(nm)!,
        baseSets: null,
      })),
    };
  }

  // 配布を複製 → じぶん(通常色)
  if (params.copyDist) {
    const day = Number(params.copyDist);
    const info = distMenuInfo(cycles, day);
    return {
      kind: "custom",
      dayNumber: null,
      menuName: `${info.name}（自分用）`,
      editLogId: null,
      exercises: distInitialExercises(cycles, day).map((e) => ({
        ...e,
        source: "added" as const,
        baseSets: null, // 複製後はじぶん=通常色
      })),
    };
  }

  // 配布そのまま(のり初期値・紫基準あり)
  if (params.day) {
    const day = Number(params.day);
    if (!Number.isFinite(day) || day < 1) return null;
    const info = distMenuInfo(cycles, day);
    return {
      kind: "dist",
      dayNumber: day,
      menuName: info.name,
      editLogId: null,
      exercises: distInitialExercises(cycles, day),
    };
  }

  // 1から(空・通常色)
  return { kind: "custom", dayNumber: null, menuName: "じぶんメニュー", editLogId: null, exercises: [] };
}

// ---- グリッド下見モーダル(§2-2) ----

export type DistPreview = {
  day: number;
  name: string;
  exercises: { name: string; reps: string; videoUrl: string | null }[];
};

/** おすすめ順/未実施配布マス → 配布内容(「このメニューをやる」) */
export async function getDistPreview(day: number): Promise<DistPreview | null> {
  const menu = await getMyCurrentMenu();
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;
  const dm = resolveDayMenu(cycles, "medium", day);
  if (!dm) return null;
  const info = distMenuInfo(cycles, day);
  return {
    day,
    name: info.name,
    exercises: (dm.種目 ?? [])
      .filter((e) => e.種目名)
      .map((e) => {
        const rs = parseRepsSets(e.回数);
        return {
          name: cleanExerciseName(e.種目名),
          reps: rs.reps != null ? `${rs.reps}回${rs.sets != null ? ` × ${rs.sets}` : ""}` : "",
          videoUrl: resolveExerciseVideo(e) ?? lookupVideoByName(e.種目名),
        };
      }),
  };
}

export type LogDetailSet = { kg: number | null; reps: number | null; arranged: boolean };
export type LogDetail = {
  logId: string;
  date: string;
  isToday: boolean;
  isCustom: boolean;
  isRest: boolean;
  dayNumber: number | null;
  menuName: string;
  exercises: { name: string; source: "original" | "added"; sets: LogDetailSet[] }[];
};

/** 実施済み/先週マス → その日の実施記録(「もう一度やる」/当日は「内容を修正する」) */
export async function getLogDetail(logId: string): Promise<LogDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: log } = await supabase
    .from("user_workout_logs")
    .select("id, date, day_number, is_custom, primary_target, status")
    .eq("id", logId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!log) return null;

  const menu = await getMyCurrentMenu(user.id);
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;
  const isCustom = !!log.is_custom;
  const isRest = log.status === "rest_done";
  const dayNumber = (log.day_number as number | null) ?? null;
  const menuName = isRest
    ? "休養日・ストレッチ"
    : isCustom
      ? (log.primary_target ? `${log.primary_target}の日` : "じぶんメニュー")
      : distMenuInfo(cycles, dayNumber ?? 0).name;

  let exercises: LogDetail["exercises"] = [];
  if (!isRest) {
    // のり基準(配布のアレンジ紫判定用)
    const baseByName = new Map<string, EditorSet[]>();
    if (!isCustom && dayNumber != null) {
      for (const e of distInitialExercises(cycles, dayNumber)) baseByName.set(e.name, e.sets);
    }
    const loaded = await loadLogExercises(supabase, logId, null, cycles);
    exercises = loaded.map((ex) => {
      const base = baseByName.get(ex.name) ?? null;
      const isAdded = ex.source === "added";
      return {
        name: ex.name,
        source: ex.source,
        sets: ex.sets.map((s, i) => {
          const b = base?.[i];
          const arranged =
            isAdded || !base || b == null || s.kg !== b.kg || s.reps !== b.reps;
          return { kg: s.kg, reps: s.reps, arranged };
        }),
      };
    });
  }

  return {
    logId: log.id as string,
    date: log.date as string,
    isToday: (log.date as string) === jstTodayStr(),
    isCustom,
    isRest,
    dayNumber,
    menuName,
    exercises,
  };
}
