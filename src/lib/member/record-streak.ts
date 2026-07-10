import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * 継続日数(点20・M7確定7/7)。
 * 体組成・食事・トレ(完了/休養)・学習 のいずれかの記録がついた日の連続日数(JST)。
 * 当日に記録があれば当日から、無く昨日にあれば昨日から。どちらも無ければ0。
 */
export async function getRecordStreak(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const admin = createAdminClient();
  const jstOffset = 9 * 3600 * 1000;
  const toJstDate = (iso: string) =>
    new Date(new Date(iso).getTime() + jstOffset).toISOString().slice(0, 10);

  const [bm, meals, workouts, lessons] = await Promise.all([
    admin.from("body_metrics").select("recorded_at").eq("user_id", user.id),
    admin.from("meal_logs").select("date").eq("user_id", user.id),
    admin
      .from("user_workout_logs")
      .select("date")
      .eq("user_id", user.id)
      .in("status", ["done", "rest_done"]),
    admin
      .from("lesson_progress")
      .select("last_watched_at")
      .eq("user_id", user.id)
      .not("last_watched_at", "is", null),
  ]);

  const days = new Set<string>();
  for (const r of (bm.data ?? []) as { recorded_at: string }[])
    if (r.recorded_at) days.add(r.recorded_at.slice(0, 10));
  for (const r of (meals.data ?? []) as { date: string }[]) if (r.date) days.add(r.date);
  for (const r of (workouts.data ?? []) as { date: string }[]) if (r.date) days.add(r.date);
  for (const r of (lessons.data ?? []) as { last_watched_at: string }[])
    if (r.last_watched_at) days.add(toJstDate(r.last_watched_at));

  if (days.size === 0) return 0;

  const today = jstTodayStr();
  const dayMs = 86_400_000;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const yesterday = new Date(todayMs - dayMs).toISOString().slice(0, 10);

  // 起点: 今日に記録があれば今日、無く昨日にあれば昨日、どちらも無ければ0
  let cursor: number;
  if (days.has(today)) cursor = todayMs;
  else if (days.has(yesterday)) cursor = todayMs - dayMs;
  else return 0;

  let streak = 0;
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}
