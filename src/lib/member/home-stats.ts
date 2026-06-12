import { createClient } from "@/lib/supabase/server";

/**
 * ホーム v4 用 学習統計
 *
 * - completedLessons : is_completed = true の本人レッスン数
 * - totalLessons     : 公開済みレッスン総数 (全体進捗の分母)
 * - watchedSeconds   : sum(watched_seconds)、 ただし加算ロジック未実装のため通常 0
 *                       → 0 の場合は null を返し、 UI 側で「—」表示
 * - daysSinceJoined  : now - users.joined_at (日数)
 * - joinedAt         : users.joined_at (ISO)
 * - displayName      : users.name (nickname は廃止合意 / なければ「受講生」)
 */

export type HomeStats = {
  completedLessons: number;
  totalLessons: number;
  watchedSeconds: number | null;
  daysSinceJoined: number;
  joinedAt: string;
  displayName: string;
};

export async function getMyHomeStats(): Promise<HomeStats | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const nowIso = new Date().toISOString();

  const [completedQ, totalQ, watchedQ, profileQ] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_completed", true),
    supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .or(`released_at.is.null,released_at.lte.${nowIso}`),
    supabase
      .from("lesson_progress")
      .select("watched_seconds")
      .eq("user_id", user.id),
    supabase
      .from("users")
      .select("name, joined_at")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const watchedSum =
    watchedQ.data?.reduce((acc, row) => acc + (row.watched_seconds ?? 0), 0) ?? 0;

  const joinedAt = (profileQ.data?.joined_at as string | null) ?? nowIso;
  const daysSinceJoined = Math.max(
    0,
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    completedLessons: completedQ.count ?? 0,
    totalLessons: totalQ.count ?? 0,
    // 0 は「データなし」と「本当に 0 秒」の区別がつかない & 加算ロジック未実装なので null 扱い
    watchedSeconds: watchedSum > 0 ? watchedSum : null,
    daysSinceJoined,
    joinedAt,
    displayName: (profileQ.data?.name as string | null) ?? "受講生",
  };
}
