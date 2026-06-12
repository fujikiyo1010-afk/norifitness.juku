import { createClient } from "@/lib/supabase/server";

/**
 * 続きから学ぶ CTA 用
 *
 * lesson_progress.last_watched_at が最新のレッスンを取得し、
 * 章 + コース情報と合わせて返す。
 *
 * 未受講 (last_watched_at が NULL のみ) の場合は null を返し、
 * UI 側で「最初のレッスンへ」CTA に切り替える。
 */

export type LastWatchedLesson = {
  lessonId: string;
  lessonTitle: string;
  chapterId: string;
  chapterTitle: string;
  courseId: string;
  courseTitle: string;
  href: string;
};

export async function getMyLastWatchedLesson(): Promise<LastWatchedLesson | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 最も新しい last_watched_at の行を 1 件取得
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, last_watched_at")
    .eq("user_id", user.id)
    .not("last_watched_at", "is", null)
    .order("last_watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!progress?.lesson_id) return null;

  // レッスン + 章 + コース を join 取得
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      `
      id, title,
      chapters!inner(
        id, title,
        courses!inner(id, title)
      )
    `
    )
    .eq("id", progress.lesson_id as string)
    .maybeSingle();

  if (!lesson) return null;

  // Supabase の join 結果は配列でも単体でも返りうる: 単一行 (inner join) を想定
  const chapter = (Array.isArray(lesson.chapters) ? lesson.chapters[0] : lesson.chapters) as {
    id: string;
    title: string;
    courses: { id: string; title: string } | { id: string; title: string }[];
  } | undefined;
  if (!chapter) return null;

  const course = (Array.isArray(chapter.courses) ? chapter.courses[0] : chapter.courses) as
    | { id: string; title: string }
    | undefined;
  if (!course) return null;

  return {
    lessonId: lesson.id as string,
    lessonTitle: lesson.title as string,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    courseId: course.id,
    courseTitle: course.title,
    href: `/courses/${course.id}/chapters/${chapter.id}/lessons/${lesson.id}`,
  };
}
