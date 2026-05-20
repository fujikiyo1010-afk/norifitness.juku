import { createClient } from "@/lib/supabase/server";

/**
 * 受講生視点で公開済みコース・章・レッスンを取得する関数群。
 *
 * RLS でも段階公開フィルタはかかるが、admin もこれらのページを「受講生視点で」
 * 確認するため、明示的に released_at <= now() / is_published フィルタを書く。
 *
 * RLS と明示フィルタの 2 重防御で、admin 視点で開いても受講生視点と同じ表示になる。
 */

export type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export type PublicChapter = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export type PublicLesson = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  vimeo_url: string | null;
  summary_video_url: string | null;
  sub_image_url: string | null;
  meta_tags: string[] | null;
  sort_order: number;
};

const nowIso = () => new Date().toISOString();

export async function listPublicCourses(): Promise<PublicCourse[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title, description, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicCourse[];
}

export async function getPublicCourse(courseId: string): Promise<PublicCourse | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title, description, sort_order")
    .eq("id", courseId)
    .eq("is_published", true)
    .maybeSingle();
  return (data as PublicCourse | null) ?? null;
}

export async function listPublicChapters(courseId: string): Promise<PublicChapter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order")
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicChapter[];
}

export async function getPublicChapter(
  courseId: string,
  chapterId: string
): Promise<PublicChapter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order")
    .eq("id", chapterId)
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .maybeSingle();
  return (data as PublicChapter | null) ?? null;
}

export async function listPublicLessons(chapterId: string): Promise<PublicLesson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order"
    )
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicLesson[];
}

export async function getPublicLesson(
  chapterId: string,
  lessonId: string
): Promise<PublicLesson | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order"
    )
    .eq("id", lessonId)
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .maybeSingle();
  return (data as PublicLesson | null) ?? null;
}

export async function countPublicChapters(courseId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`);
  return count ?? 0;
}

export async function countPublicLessons(chapterId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`);
  return count ?? 0;
}

/**
 * 現在のログインユーザーの lesson_progress を取得。
 * RLS により自分の行のみ返るので、明示的なフィルタは不要。
 * 戻り値: lesson_id → is_completed の Map(完了レコードがあるレッスンのみ)
 */
export async function getMyLessonProgress(
  lessonIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (lessonIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, is_completed")
    .in("lesson_id", lessonIds);

  (data ?? []).forEach((row) => {
    map.set(row.lesson_id as string, row.is_completed as boolean);
  });
  return map;
}

/**
 * コースに含まれる公開済みレッスンの ID 配列を取得。
 * 進捗集計のために使う。
 */
export async function listLessonIdsInCourse(courseId: string): Promise<string[]> {
  const supabase = await createClient();
  // chapters の released_at と courses の is_published は RLS で対応済み。
  // ただし admin が「受講生視点で」見るとき RLS が緩いので、明示フィルタも入れる。
  const now = nowIso();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${now}`);
  const chapterIds = (chapters ?? []).map((c) => c.id as string);
  if (chapterIds.length === 0) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .in("chapter_id", chapterIds)
    .or(`released_at.is.null,released_at.lte.${now}`);
  return (lessons ?? []).map((l) => l.id as string);
}
