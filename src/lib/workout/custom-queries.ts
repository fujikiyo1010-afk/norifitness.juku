/**
 * じぶんメニュー棚・お気に入り・先week の読み取り(server)。破壊なし・読むだけ。
 */
import { createClient } from "@/lib/supabase/server";
import { jstTodayStr } from "@/lib/date/jst";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { distMenuInfo, targetColor } from "@/lib/workout/weekly";
import type { WorkoutCycles } from "@/lib/workout/types";

export type CustomMenuSummary = {
  id: string;
  name: string;
  target: string | null;
  color: string;
  exerciseCount: number;
  setCount: number;
  lastUsed: string | null; // "M/D" JST
};

export type CustomExercise = { exerciseName: string; sets: { weightKg: number | null; reps: number | null }[] };
export type CustomMenuDetail = { id: string; name: string; target: string | null; exercises: CustomExercise[] };

type SetRow = {
  custom_menu_id: string;
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
};

function mdLabel(dateStr: string): string {
  return `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}`;
}

/** 棚一覧(上段=じぶんメニュー)。テンプレ構成(log_id NULL)から種目数/セット数、実施ログから前回日。 */
export async function getCustomMenus(): Promise<CustomMenuSummary[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: menus } = await supabase
    .from("user_custom_menus")
    .select("id, name, primary_target")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const menuList = (menus ?? []) as { id: string; name: string; primary_target: string | null }[];
  if (menuList.length === 0) return [];
  const ids = menuList.map((m) => m.id);

  const [{ data: sets }, { data: logs }] = await Promise.all([
    supabase
      .from("user_custom_menu_sets")
      .select("custom_menu_id, exercise_name")
      .in("custom_menu_id", ids)
      .is("log_id", null),
    supabase
      .from("user_workout_logs")
      .select("custom_menu_id, date")
      .eq("user_id", user.id)
      .in("custom_menu_id", ids)
      .order("date", { ascending: false }),
  ]);

  const exByMenu = new Map<string, Set<string>>();
  const setCountByMenu = new Map<string, number>();
  for (const s of (sets ?? []) as { custom_menu_id: string; exercise_name: string }[]) {
    if (!exByMenu.has(s.custom_menu_id)) exByMenu.set(s.custom_menu_id, new Set());
    exByMenu.get(s.custom_menu_id)!.add(s.exercise_name);
    setCountByMenu.set(s.custom_menu_id, (setCountByMenu.get(s.custom_menu_id) ?? 0) + 1);
  }
  const lastByMenu = new Map<string, string>();
  for (const l of (logs ?? []) as { custom_menu_id: string | null; date: string }[]) {
    if (l.custom_menu_id && !lastByMenu.has(l.custom_menu_id)) lastByMenu.set(l.custom_menu_id, l.date);
  }

  return menuList.map((m) => ({
    id: m.id,
    name: m.name,
    target: m.primary_target,
    color: targetColor(m.primary_target),
    exerciseCount: exByMenu.get(m.id)?.size ?? 0,
    setCount: setCountByMenu.get(m.id) ?? 0,
    lastUsed: lastByMenu.has(m.id) ? mdLabel(lastByMenu.get(m.id)!) : null,
  }));
}

/** 1件の構成(編集・今日やるの初期値)。 */
export async function getCustomMenuDetail(id: string): Promise<CustomMenuDetail | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: menu } = await supabase
    .from("user_custom_menus")
    .select("id, name, primary_target")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!menu) return null;
  const { data: sets } = await supabase
    .from("user_custom_menu_sets")
    .select("exercise_name, exercise_order, set_number, weight_kg, reps")
    .eq("custom_menu_id", id)
    .is("log_id", null)
    .order("exercise_order", { ascending: true })
    .order("set_number", { ascending: true });
  const rows = (sets ?? []) as Omit<SetRow, "custom_menu_id">[];
  const byEx = new Map<string, CustomExercise>();
  const order: string[] = [];
  for (const r of rows) {
    if (!byEx.has(r.exercise_name)) {
      byEx.set(r.exercise_name, { exerciseName: r.exercise_name, sets: [] });
      order.push(r.exercise_name);
    }
    byEx.get(r.exercise_name)!.sets.push({ weightKg: r.weight_kg, reps: r.reps });
  }
  return {
    id: menu.id as string,
    name: menu.name as string,
    target: (menu.primary_target as string | null) ?? null,
    exercises: order.map((n) => byEx.get(n)!),
  };
}

export async function getFavorites(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_favorite_exercises")
    .select("exercise_name")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.exercise_name as string);
}

export type LastWeekEntry = {
  logId: string; // 実績ログid(再実施=実績が初期値でセット表へ)
  label: string; // 「脚の日」/じぶんの名前
  kind: "dist" | "custom" | "rest";
  target: string | null; // バッジ部位文字用
  color: string;
  dayLabel: string; // 「先週 月曜に実施」
  dayNumber: number | null; // 配布=letter/再投入用
  customMenuId: string | null;
};

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

/** ③先週から選ぶ(画面9)。先週やった実施(配布/じぶん)を実施順に。 */
export async function getLastWeekMenus(): Promise<LastWeekEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const menu = await getMyCurrentMenu(user.id);
  const cycles = (menu?.cycles ?? []) as WorkoutCycles;

  const today = jstTodayStr();
  const d = new Date(`${today}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow - 7); // last Monday
  const lastMon = d.toISOString().slice(0, 10);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(`${lastMon}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });

  const { data: logs } = await supabase
    .from("user_workout_logs")
    .select("id, date, day_number, is_custom, primary_target, status, custom_menu_id, completed_at")
    .eq("user_id", user.id)
    .in("date", dates)
    .order("completed_at", { ascending: true });

  const out: LastWeekEntry[] = [];
  for (const l of (logs ?? []) as {
    id: string; date: string; day_number: number | null; is_custom: boolean | null;
    primary_target: string | null; status: string; custom_menu_id: string | null;
  }[]) {
    const wd = DOW[new Date(`${l.date}T00:00:00Z`).getUTCDay()];
    const dayLabel = `先週 ${wd}曜に実施`;
    if (l.status === "rest_done") continue; // 休養日は再投入対象外
    if (l.is_custom) {
      out.push({
        logId: l.id,
        label: l.primary_target ? `${l.primary_target}の日` : "じぶんメニュー",
        kind: "custom",
        target: l.primary_target,
        color: targetColor(l.primary_target),
        dayLabel,
        dayNumber: null,
        customMenuId: l.custom_menu_id,
      });
    } else {
      const info = distMenuInfo(cycles, l.day_number ?? 0);
      out.push({
        logId: l.id,
        label: info.name,
        kind: "dist",
        target: info.target,
        color: targetColor(info.target),
        dayLabel,
        dayNumber: l.day_number,
        customMenuId: null,
      });
    }
  }
  return out;
}
