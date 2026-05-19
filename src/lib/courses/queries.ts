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
