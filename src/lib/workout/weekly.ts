/**
 * 週間プール改修(2026-07-22 / 再設計 2026-07-23)のデータ層。
 * 破壊移行なし: 既存 user_workout_logs を「日付で読み替える」だけ。
 *  - 配布メニュー = user_workout_menu.cycles の各日(A,B,C…=配布順=推奨順)。
 *  - ②今週 = 今週(月〜日JST)の日付のログ。③先週 = 先週の日付のログ(案X)。
 *  - グリッドは部位2文字略称で表示(A〜G記号は廃止)。色は状態のみ。is_custom=じぶん(★)。
 *  - ◯週目 = users.joined_at を含む週(月曜起点JST)を1週目とし、毎週月曜+1。
 */
import { createClient } from "@/lib/supabase/server";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { getMyProgress } from "@/lib/workout/logs";
import { resolveDayMenu, dayCount } from "@/lib/workout/logs-types";
import { getExerciseTarget } from "@/lib/workout/menu-display";
import { jstTodayStr } from "@/lib/date/jst";
import type { WorkoutCycles } from "@/lib/workout/types";

// 部位 → バッジ色(一覧・棚のバッジ用。グリッドでは使わない=グリッドは状態色のみ)。
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

// 略称対応表(再設計§2-1・案A)。無い名前は「・」「の日」を除いた先頭2文字にフォールバック。
const ABBR_TABLE: Record<string, string> = {
  "胸・背中の日": "胸背",
  "腕・肩の日": "腕肩",
  "腹筋・脚の日": "腹脚",
  "体幹の日": "体幹",
  "脚の日": "脚",
  "肩の日": "肩",
  "胸の日": "胸",
  "背中の日": "背中",
  "腕の日": "腕",
  "腹筋の日": "腹筋",
  "休養日": "休",
  "休養日・ストレッチ": "休",
};
export function menuAbbr(name: string, kind?: DistKind): string {
  if (kind === "rest") return "休";
  if (ABBR_TABLE[name]) return ABBR_TABLE[name];
  const stripped = name.replace(/の日$/, "").replace(/・/g, "");
  return stripped.slice(0, 2) || "他";
}

export type DistKind = "train" | "rest" | "personal";

/** 配布メニュー1本(=cyclesの1日) */
export type DistMenu = {
  index: number; // 1-based(配布順=推奨順)
  letter: string; // A,B,C…(内部識別・棚の並び等で使用)
  abbr: string; // 部位2文字略称(グリッド表示)
  name: string; // 表示名「脚の日」
  target: string; // 部位「脚」
  color: string; // バッジ色
  exCount: number; // 種目数
  kind: DistKind;
  doneThisWeek: boolean;
};

/**
 * グリッド1マス。全マスタップ可(§2-2)。
 *  - dist: 配布/配布実施。day=配布番号(モーダル取得キー)、date/logId は実施マスのみ。
 *  - custom: じぶん実施(★)。rest: 休養。empty: 記録なし(タップ不可)。
 */
export type WeekCell =
  | { kind: "dist"; abbr: string; day: number; date: string | null; logId: string | null }
  | { kind: "custom"; abbr: string | null; date: string | null; logId: string | null }
  | { kind: "rest"; date: string | null; logId: string | null }
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
  // 完了後メイン(§2-7)用: 今日の実施サマリー
  todayLogId: string | null;
  todayIsCustom: boolean;
  todayExCount: number;
  todayArranged: boolean; // 追加種目ありか(=一部アレンジ)
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
  id: string;
  date: string;
  day_number: number | null;
  is_custom: boolean | null;
  primary_target: string | null;
  status: string;
  completed_at: string | null;
};

/** 1日分のログ(複数あれば最後に完了した1つ・⑤) を取り出す */
function latestOf(dayLogs: LogRow[]): LogRow | null {
  if (dayLogs.length === 0) return null;
  return dayLogs
    .slice()
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))
    .at(-1)!;
}

/** 1日分のログ → セル(date 付き=タップで実施記録モーダル) */
function cellFromLogs(cycles: WorkoutCycles, date: string, dayLogs: LogRow[]): WeekCell {
  const latest = latestOf(dayLogs);
  if (!latest) return { kind: "empty" };
  if (latest.status === "rest_done") return { kind: "rest", date, logId: latest.id };
  if (latest.is_custom)
    return {
      kind: "custom",
      abbr: latest.primary_target ? menuAbbr(`${latest.primary_target}の日`) : null,
      date,
      logId: latest.id,
    };
  const day = latest.day_number ?? 0;
  const info = distMenuInfo(cycles, day);
  return { kind: "dist", abbr: menuAbbr(info.name, info.kind), day, date, logId: latest.id };
}

/** 1日分のログ → 表示名(今日ラベル用) */
function labelFromLogs(cycles: WorkoutCycles, dayLogs: LogRow[]): string | null {
  const latest = latestOf(dayLogs);
  if (!latest) return null;
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
    todayLogId: null,
    todayIsCustom: false,
    todayExCount: 0,
    todayArranged: false,
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
      .select("id, date, day_number, is_custom, primary_target, status, completed_at")
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
      abbr: menuAbbr(info.name, info.kind),
      name: info.name,
      target: info.target,
      color: targetColor(info.target),
      exCount: info.exCount,
      kind: info.kind,
      doneThisWeek: thisWeekDistDays.has(index),
    };
  });

  // ①推奨行(月..日): 配布順を先頭から並べる。休養は rest、それ以外は dist。7日超は詰めない。
  const recRow: WeekCell[] = Array.from({ length: 7 }, (_, i) => {
    const m = distMenus[i];
    if (!m) return { kind: "empty" as const };
    if (m.kind === "rest") return { kind: "rest" as const, date: null, logId: null };
    return { kind: "dist" as const, abbr: m.abbr, day: m.index, date: null, logId: null };
  });

  const thisRow = thisDates.map((d) => cellFromLogs(cycles, d, byDate.get(d) ?? []));
  const lastRow = lastDates.map((d) => cellFromLogs(cycles, d, byDate.get(d) ?? []));

  const remaining = distMenus.filter((m) => m.kind === "train" && !m.doneThisWeek).length;
  const nextRecommended = distMenus.find((m) => m.kind === "train" && !m.doneThisWeek) ?? null;

  const todayLogs = byDate.get(today) ?? [];
  const todayLatest = latestOf(todayLogs);
  const todayDone = !!todayLatest;
  const todayLabel = labelFromLogs(cycles, todayLogs);

  // 完了後カード用: 今日ログの種目数・アレンジ有無(追加種目)
  let todayExCount = 0;
  let todayArranged = false;
  if (todayLatest && todayLatest.status !== "rest_done") {
    const { data: items } = await supabase
      .from("user_workout_log_items")
      .select("source")
      .eq("log_id", todayLatest.id);
    const rows = (items ?? []) as { source: string }[];
    todayExCount = rows.length;
    todayArranged = rows.some((r) => r.source === "added");
  }

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
    todayLogId: todayLatest?.id ?? null,
    todayIsCustom: !!todayLatest?.is_custom,
    todayExCount,
    todayArranged,
  };
}
