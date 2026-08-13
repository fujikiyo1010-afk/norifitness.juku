"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * チャット用「レッスンを選んで貼る」ピッカーのデータ(2026-07-31・段2)。
 * 管理者がチャットで「この動画見て」とレッスンを案内する時に、URLコピペせず選ぶだけで貼れる。
 * 貼るのは本番のフルURL(アプリ内遷移されるよう host 付き)。管理のみ。
 */
export type LessonPickerItem = { id: string; title: string; url: string };

const APP_ORIGIN = "https://juku.norifitness.com";

export async function listLessonsForPicker(): Promise<LessonPickerItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("lessons")
    .select("id, title, chapter_id, chapters(course_id)")
    .order("title", { ascending: true });

  const rows = (data ?? []) as {
    id: string;
    title: string;
    chapter_id: string;
    chapters:
      | { course_id: string }
      | { course_id: string }[]
      | null;
  }[];

  return rows
    .map((r) => {
      const ch = Array.isArray(r.chapters) ? r.chapters[0] : r.chapters;
      const courseId = ch?.course_id ?? "";
      return {
        id: r.id,
        title: r.title,
        url: `${APP_ORIGIN}/courses/${courseId}/chapters/${r.chapter_id}/lessons/${r.id}`,
      };
    })
    .filter((r) => !r.url.includes("/courses//")); // course 解決できないものは除外
}
