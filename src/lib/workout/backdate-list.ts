/**
 * 過去日記録(バックデート)の一覧データ(2026-07-31)。
 * カレンダーの「記録の一覧・過去日を追加」から入る一覧。
 *   - 直近 windowDays 日を「全日」出す(記録あり/休養/抜け日)。
 *   - 週(日曜はじまり)でまとめる。今週/先週は名前、以前は日付レンジ。
 *   - 「さらに過去を見る」で入会日まで遡れる(hasMore/ nextDays)。
 * 表示用の見出し(◯周◯日目 等)は呼び出し側(page)で cycles を使って組む。
 * ここは純データ(log id 付き)だけ返す。既存の getMyWorkoutHistory は非改変。
 */

import { createClient } from "@/lib/supabase/server";
import { jstTodayStr } from "@/lib/date/jst";
import type { Intensity } from "@/lib/workout/logs-types";

export type BackdateDayKind = "done" | "rest" | "skipped" | "gap";

export type BackdateDay = {
  date: string; // YYYY-MM-DD
  weekday: string; // 日〜土
  kind: BackdateDayKind;
  logId: string | null; // 記録あり時のみ
  dayNumber: number | null;
  cycleNumber: number | null;
  intensity: Intensity;
  isCustom: boolean;
  primaryTarget: string | null;
  itemCount: number;
  addedCount: number;
  isSelfRest: boolean;
  performedDayNumber: number | null;
};

export type BackdateWeek = {
  label: string; // 今週 / 先週 / M/D〜M/D
  range: string; // 補助レンジ(今週/先週のみ・以前は空)
  days: BackdateDay[]; // 新しい日→古い日
};

export type BackdateList = {
  weeks: BackdateWeek[];
  hasMore: boolean; // まだ入会日まで遡れる
  nextDays: number; // 「さらに過去を見る」で開く窓(日数)
  windowDays: number;
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];

/** dateStr(YYYY-MM-DD)に delta 日足した YYYY-MM-DD(UTCカレンダー演算=tz非依存)。 */
function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
/** 0=日 .. 6=土 */
function dow(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
/** "M/D" */
function md(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

export async function getBackdateList(windowDays = 30): Promise<BackdateList> {
  const empty: BackdateList = { weeks: [], hasMore: false, nextDays: windowDays, windowDays };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const today = jstTodayStr();

  // 入会日(遡り下限)。joined_at が無ければ 1 年前で代替。
  const { data: profile } = await supabase
    .from("users")
    .select("joined_at")
    .eq("id", user.id)
    .maybeSingle();
  const joinDate = ((profile?.joined_at as string | null) ?? "").slice(0, 10) || addDays(today, -365);

  // 窓の開始日(今日から windowDays 日ぶん)。入会日より前には行かない。
  let windowStart = addDays(today, -(windowDays - 1));
  if (windowStart < joinDate) windowStart = joinDate;
  const hasMore = windowStart > joinDate;

  // 窓内の実施ログ。同日複数は completed_at の最後(=最新)を代表にする。
  const { data: logs } = await supabase
    .from("user_workout_logs")
    .select(
      "id, date, day_number, cycle_number, intensity, status, performed_day_number, is_self_rest, is_custom, primary_target, completed_at, user_workout_log_items(source)"
    )
    .eq("user_id", user.id)
    .gte("date", windowStart)
    .lte("date", today)
    .order("completed_at", { ascending: true, nullsFirst: true });

  type LogRow = {
    id: string;
    date: string;
    day_number: number | null;
    cycle_number: number | null;
    intensity: Intensity;
    status: "done" | "rest_done" | "skipped";
    performed_day_number: number | null;
    is_self_rest: boolean | null;
    is_custom: boolean | null;
    primary_target: string | null;
    user_workout_log_items: { source: string }[] | null;
  };
  const byDate = new Map<string, LogRow>();
  for (const r of (logs ?? []) as LogRow[]) byDate.set(r.date, r); // 昇順=最後の書き込みが残る

  // 今日→windowStart の全日を生成
  const days: BackdateDay[] = [];
  for (let cur = today; cur >= windowStart; cur = addDays(cur, -1)) {
    const log = byDate.get(cur);
    if (!log) {
      days.push({
        date: cur,
        weekday: WD[dow(cur)],
        kind: "gap",
        logId: null,
        dayNumber: null,
        cycleNumber: null,
        intensity: "medium",
        isCustom: false,
        primaryTarget: null,
        itemCount: 0,
        addedCount: 0,
        isSelfRest: false,
        performedDayNumber: null,
      });
      continue;
    }
    const items = log.user_workout_log_items ?? [];
    const kind: BackdateDayKind =
      log.status === "rest_done" ? "rest" : log.status === "skipped" ? "skipped" : "done";
    days.push({
      date: cur,
      weekday: WD[dow(cur)],
      kind,
      logId: log.id,
      dayNumber: log.day_number,
      cycleNumber: log.cycle_number,
      intensity: log.intensity,
      isCustom: !!log.is_custom,
      primaryTarget: log.primary_target,
      itemCount: items.length,
      addedCount: items.filter((i) => i.source === "added").length,
      isSelfRest: !!log.is_self_rest,
      performedDayNumber: log.performed_day_number ?? null,
    });
  }

  // 週(日曜はじまり)でまとめる。今週/先週は名前、以前はレンジ。
  const thisWeekStart = addDays(today, -dow(today));
  const lastWeekStart = addDays(thisWeekStart, -7);
  const weeksMap = new Map<string, BackdateDay[]>();
  const order: string[] = [];
  for (const dcell of days) {
    const ws = addDays(dcell.date, -dow(dcell.date));
    if (!weeksMap.has(ws)) {
      weeksMap.set(ws, []);
      order.push(ws);
    }
    weeksMap.get(ws)!.push(dcell);
  }
  const weeks: BackdateWeek[] = order.map((ws) => {
    const we = addDays(ws, 6);
    let label: string;
    let range = "";
    if (ws === thisWeekStart) {
      label = "今週";
      range = `${md(ws)}〜`;
    } else if (ws === lastWeekStart) {
      label = "先週";
      range = `${md(ws)}〜${md(we)}`;
    } else {
      label = `${md(ws)}〜${md(we)}`;
    }
    return { label, range, days: weeksMap.get(ws)! };
  });

  return { weeks, hasMore, nextDays: windowDays + 60, windowDays };
}
