"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; message: string };

type CourseInput = {
  title: string;
  description: string;
  sort_order: number;
  is_published: boolean;
};

function validate(input: CourseInput): string | null {
  if (!input.title || input.title.trim().length === 0) return "タイトルは必須です";
  if (input.title.length > 200) return "タイトルは 200 文字以内にしてください";
  if (!Number.isFinite(input.sort_order)) return "表示順は数値で入力してください";
  return null;
}

export async function createCourse(input: CourseInput): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").insert({
    title: input.title.trim(),
    description: input.description || null,
    sort_order: input.sort_order,
    is_published: input.is_published,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function updateCourse(
  id: string,
  input: CourseInput
): Promise<ActionResult> {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title: input.title.trim(),
      description: input.description || null,
      sort_order: input.sort_order,
      is_published: input.is_published,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { ok: true };
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/courses");
  return { ok: true };
}
