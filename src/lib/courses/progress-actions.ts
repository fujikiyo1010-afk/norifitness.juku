"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SetLessonProgressResult =
  | { ok: true; is_completed: boolean }
  | { ok: false; message: string };

/**
 * 受講生がレッスンの完了状態を切り替える。
 *
 * upsert で lesson_progress 行を作成/更新。
 * - is_completed = true  → completed_at に now() を入れる
 * - is_completed = false → completed_at は NULL に戻す(履歴管理が要るなら別テーブル化)
 * RLS により他人の行は触れない設計。
 */
export async function setLessonProgress(
  lessonId: string,
  isCompleted: boolean
): Promise<SetLessonProgressResult> {
  if (typeof lessonId !== "string" || lessonId.length === 0) {
    return { ok: false, message: "lesson_id が不正です" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        is_completed: isCompleted,
        completed_at: isCompleted ? now : null,
        last_watched_at: now,
      },
      {
        onConflict: "user_id,lesson_id",
      }
    );

  if (error) {
    return { ok: false, message: error.message };
  }

  // 受講生側ページ全体を再検証(進捗バッジが各所に出るため)
  revalidatePath("/courses", "layout");
  return { ok: true, is_completed: isCompleted };
}
