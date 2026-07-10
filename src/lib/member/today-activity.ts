import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * ホーム「今日やること」の当日達成判定(P3〜P4・v1=体組成/学習/食事の3つ)。
 *   - recordedBody: 今日(JST)の体組成記録があるか
 *   - learned: 今日(JST)にレッスンを視聴したか(last_watched_at)
 *   - recordedMeal: 今日(JST)に食事を1食でも記録したか(M16=「1食で✓」)
 *   - mealTypes: 今日記録済みの食事タイプ(残枠テキスト用)
 * ※トレはP5で追加。
 */
export type TodayActivity = {
  recordedBody: boolean;
  learned: boolean;
  recordedMeal: boolean;
  mealTypes: string[];
};

export async function getTodayActivity(): Promise<TodayActivity> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { recordedBody: false, learned: false, recordedMeal: false, mealTypes: [] };

  const admin = createAdminClient();
  const today = jstTodayStr(); // YYYY-MM-DD (JST暦日)

  const [bmRes, lpRes, mealRes] = await Promise.all([
    admin
      .from("body_metrics")
      .select("id")
      .eq("user_id", user.id)
      .eq("recorded_at", today)
      .limit(1),
    admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .gte("last_watched_at", `${today}T00:00:00+09:00`)
      .limit(1),
    admin
      .from("meal_logs")
      .select("meal_type")
      .eq("user_id", user.id)
      .eq("date", today),
  ]);

  const mealTypes = Array.from(
    new Set(((mealRes.data ?? []) as { meal_type: string }[]).map((m) => m.meal_type))
  );

  return {
    recordedBody: (bmRes.data?.length ?? 0) > 0,
    learned: (lpRes.data?.length ?? 0) > 0,
    recordedMeal: mealTypes.length > 0,
    mealTypes,
  };
}
