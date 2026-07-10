"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MealType } from "./types";

/**
 * 食事(P4-a)の作成/更新/削除。
 * 写真アップロード本体はクライアントが圧縮後に meal-photos bucket へ直接PUT。
 * ここでは meal_logs / meal_log_items 行と、削除時の storage 後始末を担う。
 */

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

export type MealItemInput = {
  name: string;
  source?: "table" | "manual" | "none";
  food_table_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carb_g?: number | null;
};

const VALID_TYPES: MealType[] = ["朝", "昼", "夕", "間"];

function normalizeItems(items: MealItemInput[], userScopeOk: boolean) {
  void userScopeOk;
  return items
    .filter((it) => (it.name ?? "").trim().length > 0)
    .map((it, i) => ({
      name: it.name.trim(),
      source: it.source ?? "none",
      food_table_id: it.food_table_id ?? null,
      quantity: it.quantity ?? null,
      unit: it.unit ?? null,
      kcal: it.kcal ?? null,
      protein_g: it.protein_g ?? null,
      fat_g: it.fat_g ?? null,
      carb_g: it.carb_g ?? null,
      sort_order: i,
    }));
}

/** 食事を新規作成。写真パスは {user_id}/... 前提。 */
export async function createMealLog(input: {
  date: string;
  meal_type: MealType;
  memo?: string | null;
  photos?: string[];
  items?: MealItemInput[];
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  if (!input.date) return { ok: false, message: "日付が必要です" };
  if (!VALID_TYPES.includes(input.meal_type))
    return { ok: false, message: "食事の種類が不正です" };

  const photos = (input.photos ?? []).filter((p) => p.startsWith(`${user.id}/`));

  const { data: log, error } = await supabase
    .from("meal_logs")
    .insert({
      user_id: user.id,
      date: input.date,
      meal_type: input.meal_type,
      memo: input.memo?.trim() || null,
      photos,
    })
    .select("id")
    .single();
  if (error || !log) return { ok: false, message: `保存エラー: ${error?.message}` };

  const items = normalizeItems(input.items ?? [], true);
  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from("meal_log_items")
      .insert(items.map((it) => ({ ...it, meal_log_id: log.id })));
    if (itemErr) {
      // 品目の保存に失敗したら親も巻き戻す(孤立防止)
      await supabase.from("meal_logs").delete().eq("id", log.id);
      return { ok: false, message: `品目の保存エラー: ${itemErr.message}` };
    }
  }

  revalidatePath("/meals");
  revalidatePath("/");
  return { ok: true, data: { id: log.id } };
}

/** 既存の食事を更新(品目は総入れ替え)。 */
export async function updateMealLog(
  id: string,
  input: { memo?: string | null; photos?: string[]; items?: MealItemInput[] }
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  // 所有チェック
  const { data: existing } = await supabase
    .from("meal_logs")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.user_id !== user.id)
    return { ok: false, message: "編集できません" };

  const photos = (input.photos ?? []).filter((p) => p.startsWith(`${user.id}/`));
  const { error } = await supabase
    .from("meal_logs")
    .update({ memo: input.memo?.trim() || null, photos })
    .eq("id", id);
  if (error) return { ok: false, message: `更新エラー: ${error.message}` };

  // 品目総入れ替え
  await supabase.from("meal_log_items").delete().eq("meal_log_id", id);
  const items = normalizeItems(input.items ?? [], true);
  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from("meal_log_items")
      .insert(items.map((it) => ({ ...it, meal_log_id: id })));
    if (itemErr) return { ok: false, message: `品目の保存エラー: ${itemErr.message}` };
  }

  revalidatePath("/meals");
  revalidatePath("/");
  return { ok: true };
}

/** 食事を削除(品目はカスケード + storage 写真も後始末)。 */
export async function deleteMealLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { data: existing } = await supabase
    .from("meal_logs")
    .select("id, user_id, photos")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.user_id !== user.id)
    return { ok: false, message: "削除できません" };

  const photos = (existing.photos as string[] | null) ?? [];
  const { error } = await supabase.from("meal_logs").delete().eq("id", id);
  if (error) return { ok: false, message: `削除エラー: ${error.message}` };

  if (photos.length > 0) {
    try {
      await supabase.storage.from("meal-photos").remove(photos);
    } catch {}
  }

  revalidatePath("/meals");
  revalidatePath("/");
  return { ok: true };
}
