"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

/**
 * 実践リスト アクション (2026-06-18 線① #5)
 *
 * - createAction: 新規宣言 ・ lesson_id 任意 (= 自発作成可)
 * - toggleTried: 試した/未試行 トグル ・ tried=true で tried_at=NOW、 false で tried_at=NULL
 * - updateReflection: 振り返り更新
 * - deleteAction: 削除
 */

export async function createAction(input: {
  planned_action: string;
  lesson_id?: string | null;
}): Promise<ActionResult> {
  const text = (input.planned_action ?? "").trim();
  if (text.length === 0)
    return { ok: false, message: "宣言を入力してください" };
  if (text.length > 280)
    return { ok: false, message: "280 文字以内で入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { data, error } = await supabase
    .from("real_world_actions")
    .insert({
      user_id: user.id,
      lesson_id: input.lesson_id ?? null,
      planned_action: text,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/my-log");
  revalidatePath("/my-log/actions");
  return { ok: true, id: data.id as string };
}

export async function toggleTried(
  id: string,
  next: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const payload: { tried: boolean; tried_at: string | null } = {
    tried: next,
    tried_at: next ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("real_world_actions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/my-log");
  revalidatePath("/my-log/actions");
  return { ok: true };
}

export async function updateReflection(
  id: string,
  reflection: string
): Promise<ActionResult> {
  const trimmed = (reflection ?? "").trim();
  if (trimmed.length > 1000)
    return { ok: false, message: "振り返りは 1000 文字以内で入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { error } = await supabase
    .from("real_world_actions")
    .update({ reflection: trimmed.length === 0 ? null : trimmed })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/my-log");
  revalidatePath("/my-log/actions");
  return { ok: true };
}

export async function deleteAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { error } = await supabase
    .from("real_world_actions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/my-log");
  revalidatePath("/my-log/actions");
  return { ok: true };
}
