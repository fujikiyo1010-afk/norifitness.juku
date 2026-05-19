"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

type ChapterInput = {
  title: string;
  description: string;
  sort_order: number;
  released_at: string | null; // ISO 文字列 or null
};

function validate(input: ChapterInput): string | null {
  if (!input.title || input.title.trim().length === 0) return "タイトルは必須です";
  if (input.title.length > 200) return "タイトルは 200 文字以内にしてください";
  if (!Number.isFinite(input.sort_order)) return "表示順は数値で入力してください";
  if (input.released_at !== null && Number.isNaN(new Date(input.released_at).getTime())) {
    return "公開日時の形式が不正です";
  }
  return null;
}

export async function createChapter(
  courseId: string,
  input: ChapterInput
): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase.from("chapters").insert({
    course_id: courseId,
    title: input.title.trim(),
    description: input.description || null,
    sort_order: input.sort_order,
    released_at: input.released_at,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function updateChapter(
  courseId: string,
  chapterId: string,
  input: ChapterInput
): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("chapters")
    .update({
      title: input.title.trim(),
      description: input.description || null,
      sort_order: input.sort_order,
      released_at: input.released_at,
    })
    .eq("id", chapterId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/chapters/${chapterId}`);
  return { ok: true };
}

export async function deleteChapter(
  courseId: string,
  chapterId: string
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("chapters").delete().eq("id", chapterId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}
