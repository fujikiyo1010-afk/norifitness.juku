import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * ホーム「今日やること」の当日達成判定(P3・v1=体組成/学習の2つ)。
 *   - recordedBody: 今日(JST)の体組成記録があるか
 *   - learned: 今日(JST)にレッスンを視聴したか(last_watched_at)
 * ※食事/トレはP4/P5で追加。
 */
export type TodayActivity = {
  recordedBody: boolean;
  learned: boolean;
};

export async function getTodayActivity(): Promise<TodayActivity> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { recordedBody: false, learned: false };

  const admin = createAdminClient();
  const today = jstTodayStr(); // YYYY-MM-DD (JST暦日)

  const [bmRes, lpRes] = await Promise.all([
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
  ]);

  return {
    recordedBody: (bmRes.data?.length ?? 0) > 0,
    learned: (lpRes.data?.length ?? 0) > 0,
  };
}
