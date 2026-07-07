import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 管理画面 ・ 全受講生 学習進捗オーバービュー (2026-07-07)
 *
 * 「動画を見ているか＝各受講生がレッスンの"完了"を何個付けたか」を一覧で確認する。
 *   - 進捗の実体は lesson_progress.is_completed (受講生が手動で押した"完了"トグル)。
 *     ＝ 実際の再生秒数ではない (watched_seconds は未実装)。ここは完了ベースの集計。
 *   - 最終活動 = lesson_progress.last_watched_at の最大 (＝最後に完了トグルを操作した日時)。
 *   - 総レッスン数は 受講生ハブの学習タブと同じ数え方 (courses→chapters→lessons)。
 */

export type LearningOverviewRow = {
  userId: string;
  name: string;
  joinedAt: string | null;
  completed: number; // 完了済レッスン数
  percent: number; // 完了 / 総レッスン
  lastActivity: string | null; // 最終活動 (last_watched_at の最大)
};

export type LearningOverview = {
  totalLessons: number;
  studentCount: number;
  averagePercent: number;
  rows: LearningOverviewRow[]; // 完了数の多い順
};

export async function getLearningOverview(): Promise<LearningOverview> {
  const admin = createAdminClient();

  const [coursesRes, usersRes, progressRes] = await Promise.all([
    admin.from("courses").select("id, chapters(id, lessons(id))"),
    admin.from("users").select("id, name, joined_at").order("joined_at", {
      ascending: true,
    }),
    admin
      .from("lesson_progress")
      .select("user_id, is_completed, last_watched_at"),
  ]);

  // 総レッスン数 (courses→chapters→lessons)
  type CourseLike = {
    chapters?: { lessons?: { id: string }[] | null }[] | null;
  };
  let totalLessons = 0;
  for (const c of (coursesRes.data as CourseLike[] | null) ?? []) {
    for (const ch of c.chapters ?? []) {
      totalLessons += ch.lessons?.length ?? 0;
    }
  }

  // user_id → 完了数 / 最終活動
  const doneCount = new Map<string, number>();
  const lastAct = new Map<string, string>();
  for (const p of (progressRes.data as
    | { user_id: string; is_completed: boolean; last_watched_at: string | null }[]
    | null) ?? []) {
    if (p.is_completed) {
      doneCount.set(p.user_id, (doneCount.get(p.user_id) ?? 0) + 1);
    }
    const lw = p.last_watched_at;
    if (lw) {
      const cur = lastAct.get(p.user_id);
      if (!cur || lw > cur) lastAct.set(p.user_id, lw);
    }
  }

  const users =
    (usersRes.data as { id: string; name: string | null; joined_at: string | null }[] | null) ??
    [];

  const rows: LearningOverviewRow[] = users
    .map((u) => {
      const completed = doneCount.get(u.id) ?? 0;
      return {
        userId: u.id,
        name: u.name ?? "(名前なし)",
        joinedAt: u.joined_at,
        completed,
        percent: totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0,
        lastActivity: lastAct.get(u.id) ?? null,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  const studentCount = rows.length;
  const averagePercent =
    studentCount > 0
      ? Math.round(rows.reduce((acc, r) => acc + r.percent, 0) / studentCount)
      : 0;

  return { totalLessons, studentCount, averagePercent, rows };
}
