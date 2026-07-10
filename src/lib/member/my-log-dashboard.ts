import { createClient } from "@/lib/supabase/server";
import { getMyHomeStats } from "@/lib/member/home-stats";
import { getReviewsStats } from "@/lib/courses/queries";
import { getActionsStats } from "@/lib/practice/queries";

/**
 * 学びの記録ダッシュボード(M18・案3・P3-2)のデータ。
 *  - 数字帯4指標: 進捗 / 振り返り / 宣言→実践 / 継続
 *  - 大カード3枚: 振り返りノート / 実践リスト / 完了レッスン
 *    (「保存した添削」カードはP7まで非表示 = 4問④)
 *
 * 既存の集計helper(home-stats / reviews / actions)を再利用し、
 * 各カードの「最新」行だけ軽量に追加取得する。
 */
export type MyLogDashboard = {
  // 数字帯
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  reviewCount: number;
  implementationRate: number; // 宣言→実践 %
  streakDays: number; // 継続(振り返り連続日数)
  // 大カード
  latestReview: { title: string; dateLabel: string } | null;
  untriedCount: number;
  latestUntriedText: string | null;
  latestCompleted: { title: string; dateLabel: string } | null;
};

/** ISO → JST の M/D 表記 */
function jstShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

export async function getMyLogDashboard(): Promise<MyLogDashboard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty: MyLogDashboard = {
    completedLessons: 0,
    totalLessons: 0,
    progressPercent: 0,
    reviewCount: 0,
    implementationRate: 0,
    streakDays: 0,
    latestReview: null,
    untriedCount: 0,
    latestUntriedText: null,
    latestCompleted: null,
  };
  if (!user) return empty;

  const [homeStats, reviewStats, actionStats, latestReviewRow, latestUntriedRow, latestCompletedRow] =
    await Promise.all([
      getMyHomeStats(),
      getReviewsStats(),
      getActionsStats(),
      // 最新の振り返り 1件
      supabase
        .from("lesson_reviews")
        .select("lesson_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 最新の「まだ試していない」宣言 1件
      supabase
        .from("real_world_actions")
        .select("planned_action, created_at")
        .eq("user_id", user.id)
        .eq("tried", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 最新の完了レッスン 1件
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at, updated_at")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // レッスンタイトルの解決(振り返り最新 + 完了最新)
  const lessonIds = [
    (latestReviewRow.data as { lesson_id?: string } | null)?.lesson_id,
    (latestCompletedRow.data as { lesson_id?: string } | null)?.lesson_id,
  ].filter((v): v is string => Boolean(v));

  let titleById = new Map<string, string>();
  if (lessonIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title")
      .in("id", lessonIds);
    titleById = new Map(
      ((lessons ?? []) as { id: string; title: string }[]).map((l) => [l.id, l.title])
    );
  }

  const reviewData = latestReviewRow.data as
    | { lesson_id: string; created_at: string }
    | null;
  const latestReview = reviewData
    ? {
        title: titleById.get(reviewData.lesson_id) ?? "レッスン",
        dateLabel: jstShortDate(reviewData.created_at),
      }
    : null;

  const untriedData = latestUntriedRow.data as
    | { planned_action: string; created_at: string }
    | null;

  const completedData = latestCompletedRow.data as
    | { lesson_id: string; completed_at: string | null; updated_at: string }
    | null;
  const latestCompleted = completedData
    ? {
        title: titleById.get(completedData.lesson_id) ?? "レッスン",
        dateLabel: jstShortDate(completedData.completed_at ?? completedData.updated_at),
      }
    : null;

  const completedLessons = homeStats?.completedLessons ?? 0;
  const totalLessons = homeStats?.totalLessons ?? 0;

  return {
    completedLessons,
    totalLessons,
    progressPercent:
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    reviewCount: reviewStats.total,
    implementationRate: actionStats.implementationRate,
    streakDays: reviewStats.streakDays,
    latestReview,
    untriedCount: Math.max(0, actionStats.totalCount - actionStats.triedTotal),
    latestUntriedText: untriedData?.planned_action ?? null,
    latestCompleted,
  };
}
