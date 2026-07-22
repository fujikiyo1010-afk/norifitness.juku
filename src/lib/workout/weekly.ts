/**
 * 週間プール改修(2026-07-22)のデータ層。
 * 破壊移行なし: 既存 user_workout_logs を「日付で読み替える」だけ。
 *  - 配布メニュー = user_workout_menu.cycles の各日(A,B,C…=配布順=推奨順)。
 *  - ②今週 = 今週(月〜日JST)の日付のログ。③先週 = 先週の日付のログ(案X)。
 *  - day_number → 配布メニュー(A脚/B胸背…)へ変換して表示。is_custom はじぶんメニュー(★)。
 *  - ◯週目 = users.joined_at を含む週(月曜起点JST)を1週目とし、毎週月曜+1。
 */
import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { getMyProgress } from "@/lib/workout/logs";
import { resolveDayMenu, dayCount } from "@/lib/workout/logs-types";
import { getExerciseTarget } from "@/lib/workout/menu-display";
import { jstTodayStr } from "@/lib/date/jst";
import type { WorkoutCycles } from "@/lib/workout/types";

// 部位 → バッジ色(配布・じぶん共通)。C-3⑫: 主部位データ(getExerciseTarget)の一般名称に割り付け。
const TARGET_COLOR: Record<string, string> = {
  脚: "#5b7a9d",
  胸: "#c88a4a",
  背中: "#7a9d5b",
  肩: "#c86a6a",
  腕: "#8a6ac8",
  腹筋: "#4a9d9d",
  全身: "#6a8a9d",
};
export function targetColor(target: string | null | undefined): string {
  if (!target) return "#6a6256";
  const first = target.split("・")[0];
  return TARGET_COLOR[first] ?? "#6a6256";
}

export type DistKind = "train" | "rest" | "personal";

/** 配布メニュー1本(=cyclesの1日) */
export type DistMenu = {
  index: number; // 1-based(配布順=推奨順)
  letter: string; // A,B,C…
  name: string; // 表示名「脚の日」
  target: string; // 部位「脚」
  color: string; // バッジ色
  exCount: number; // 種目数
  kind: DistKind;
  doneThisWeek: boolean;
};

export type WeekCell =
  | { kind: "dist"; letter: string; color: string }
  | { kind: "custom" }
  | { kind: "rest" }
  | { kind: "empty" };

export type WeeklyTraining = {
  hasMenu: boolean;
  started: boolean;
  weekNumber: number; // ◯週目
  distMenus: DistMenu[]; // 推奨順(A..N)
  recRow: WeekCell[]; // ①推奨 7セル(月..日)
  thisRow: WeekCell[]; // ②今週 7セル
  lastRow: WeekCell[]; // ③先週 7セル
  remaining: number; // 残り配布メニュー(train・未実施)
  nextRecommended: DistMenu | null; // 次のおすすめ(未実施の推奨順で先頭)
  todayDone: boolean;
  todayLabel: string | null; // 今日やった配布/じぶんの表示名
};

function menuLetter(i: number): string {
  return String.fromCharCode(64 + i); // 1->A
}

/** cyclesの1日 → 表示情報。強度は medium 固定(配布メニューの識別・部位は強度不変) */
export function distMenuInfo(cycles: WorkoutCycles, day: number): {
  name: string;
  target: string;
  kind: DistKind;
  exCount: number;
} {
  const dm = resolveDayMenu(cycles, "medium", day);
  if (!dm) return { name: `${day}日目`, target: "全身", kind: "train", exCount: 0 };
  if (dm.種別 === "休息") return { name: "休養日", target: "休", kind: "rest", exCount: 0 };
  if (dm.種別 === "パーソナル")
    return { name: "パーソナル", target: "パーソナル", kind: "personal", exCount: 0 };
  const ex = (dm.種目 ?? []).filter((e) => e.種目名);
  const target = getExerciseTarget(ex.flatMap((e) => e.主部位 ?? []));
  const name =
    dm.日 && dm.日 !== `${day}日目`
      ? dm.日
      : target && target !== "全身"
        ? `${target}の日`
        : "トレーニング";
  return { name, target, kind: "train", exCount: ex.length };
}

// --- JST週の暦日ヘルパ(両端UTC深夜アンカー、jst.ts と同規則) ---
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekDates(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}
function emptyRow(): WeekCell[] {
  return Array.from({ length: 7 }, () => ({ kind: "empty" as const }));
}

type LogRow = {
  date: string;
  day_number: number | null;
  is_custom: boolean | null;
  primary_target: string | null;
  status: string;
  completed_at: string | null;
};

/** 1日分のログ(複数あれば最後に完了した1つ・⑤) → セル */
function cellFromLogs(cycles: WorkoutCycles, dayLogs: LogRow[]): WeekCell {
  if (dayLogs.length === 0) return { kind: "empty" };
  const latest = dayLogs
    .slice()
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))
    .at(-1)!;
  if (latest.status === "rest_done") return { kind: "rest" };
  if (latest.is_custom) return { kind: "custom" };
  const day = latest.day_number ?? 0;
  const info = distMenuInfo(cycles, day);
  return { kind: "dist", letter: menuLetter(day), color: targetColor(info.target) };
}

/** 1日分のログ → 表示名(今日ラベル用) */
function labelFromLogs(cycles: WorkoutCycles, dayLogs: LogRow[]): string | null {
  if (dayLogs.length === 0) return null;
  const latest = dayLogs
    .slice()
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))
    .at(-1)!;
  if (latest.status === "rest_done") return "休養日";
  if (latest.is_custom) return latest.primary_target ? `${latest.primary_target}の日` : "じぶんメニュー";
  return distMenuInfo(cycles, latest.day_number ?? 0).name;
}

export async function getWeeklyTraining(): Promise<WeeklyTraining> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empty: WeeklyTraining = {
    hasMenu: false,
    started: false,
    weekNumber: 1,
    distMenus: [],
    recRow: emptyRow(),
    thisRow: emptyRow(),
    lastRow: emptyRow(),
    remaining: 0,
    nextRecommended: null,
    todayDone: false,
    todayLabel: null,
  };
  if (!user) return empty;

  const menu = await getMyCurrentMenu(user.id);
  if (!menu) return empty;
  const cycles = (menu.cycles ?? []) as WorkoutCycles;
  const started = !!(await getMyProgress(user.id));

  const today = jstTodayStr();
  const thisMon = mondayOf(today);
  const lastMon = addDays(thisMon, -7);
  const thisDates = weekDates(thisMon);
  const lastDates = weekDates(lastMon);

  // joined_at → ◯週目 / 今週+先週のログ を並列取得
  const [{ data: urow }, { data: logsData }] = await Promise.all([
    supabase.from("users").select("joined_at").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_workout_logs")
      .select("date, day_number, is_custom, primary_target, status, completed_at")
      .eq("user_id", user.id)
      .in("date", [...thisDates, ...lastDates]),
  ]);

  let weekNumber = 1;
  if (urow?.joined_at) {
    const joinedDate = jstTodayStr(Date.parse(urow.joined_at as string));
    const joinMon = mondayOf(joinedDate);
    const diff = Math.round(
      (Date.parse(`${thisMon}T00:00:00Z`) - Date.parse(`${joinMon}T00:00:00Z`)) / (7 * 86_400_000)
    );
    weekNumber = Math.max(1, diff + 1);
  }

  const logs = (logsData ?? []) as LogRow[];
  const byDate = new Map<string, LogRow[]>();
  for (const l of logs) {
    const arr = byDate.get(l.date) ?? [];
    arr.push(l);
    byDate.set(l.date, arr);
  }

  // 配布メニュー(推奨順) + 今週やったか
  const total = dayCount(cycles, "medium");
  const thisWeekDistDays = new Set(
    logs
      .filter((l) => thisDates.includes(l.date) && !l.is_custom && l.status !== "skipped" && l.day_number != null)
      .map((l) => l.day_number as number)
  );
  const distMenus: DistMenu[] = Array.from({ length: total }, (_, i) => {
    const index = i + 1;
    const info = distMenuInfo(cycles, index);
    return {
      index,
      letter: menuLetter(index),
      name: info.name,
      target: info.target,
      color: targetColor(info.target),
      exCount: info.exCount,
      kind: info.kind,
      doneThisWeek: thisWeekDistDays.has(index),
    };
  });

  // ①推奨行(月..日): 配布順を先頭から並べる。休養/パーソナルは rest/empty 相当。7日超は詰めない。
  const recRow: WeekCell[] = Array.from({ length: 7 }, (_, i) => {
    const m = distMenus[i];
    if (!m) return { kind: "empty" as const };
    if (m.kind === "rest") return { kind: "rest" as const };
    return { kind: "dist" as const, letter: m.letter, color: m.color };
  });

  const thisRow = thisDates.map((d) => cellFromLogs(cycles, byDate.get(d) ?? []));
  const lastRow = lastDates.map((d) => cellFromLogs(cycles, byDate.get(d) ?? []));

  const remaining = distMenus.filter((m) => m.kind === "train" && !m.doneThisWeek).length;
  const nextRecommended = distMenus.find((m) => m.kind === "train" && !m.doneThisWeek) ?? null;

  const todayLogs = byDate.get(today) ?? [];
  const todayDone = todayLogs.length > 0;
  const todayLabel = labelFromLogs(cycles, todayLogs);

  return {
    hasMenu: true,
    started,
    weekNumber,
    distMenus,
    recRow,
    thisRow,
    lastRow,
    remaining,
    nextRecommended,
    todayDone,
    todayLabel,
  };
}
