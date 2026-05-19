"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

type LessonInput = {
  title: string;
  description: string;
  vimeo_url: string;
  summary_video_url: string;
  sub_image_url: string;
  meta_tags_csv: string; // カンマ区切り入力 → 配列に変換
  sort_order: number;
  released_at: string | null;
};

function validate(input: LessonInput): string | null {
  if (!input.title || input.title.trim().length === 0) return "タイトルは必須です";
  if (input.title.length > 200) return "タイトルは 200 文字以内にしてください";
  if (!Number.isFinite(input.sort_order)) return "表示順は数値で入力してください";
  if (input.released_at !== null && Number.isNaN(new Date(input.released_at).getTime())) {
    return "公開日時の形式が不正です";
  }
  return null;
}

function parseTags(csv: string): string[] | null {
  const tags = csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return tags.length > 0 ? tags : null;
}

export async function createLesson(
  courseId: string,
  chapterId: string,
  input: LessonInput
): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase.from("lessons").insert({
    chapter_id: chapterId,
    title: input.title.trim(),
    description: input.description || null,
    vimeo_url: input.vimeo_url || null,
    summary_video_url: input.summary_video_url || null,
    sub_image_url: input.sub_image_url || null,
    meta_tags: parseTags(input.meta_tags_csv),
    sort_order: input.sort_order,
    released_at: input.released_at,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/courses/${courseId}/chapters/${chapterId}`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function updateLesson(
  courseId: string,
  chapterId: string,
  lessonId: string,
  input: LessonInput
): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: input.title.trim(),
      description: input.description || null,
      vimeo_url: input.vimeo_url || null,
      summary_video_url: input.summary_video_url || null,
      sub_image_url: input.sub_image_url || null,
      meta_tags: parseTags(input.meta_tags_csv),
      sort_order: input.sort_order,
      released_at: input.released_at,
    })
    .eq("id", lessonId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/courses/${courseId}/chapters/${chapterId}`);
  return { ok: true };
}

export async function deleteLesson(
  courseId: string,
  chapterId: string,
  lessonId: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/courses/${courseId}/chapters/${chapterId}`);
  return { ok: true };
}
