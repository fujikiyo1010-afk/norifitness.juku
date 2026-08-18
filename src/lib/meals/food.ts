import { createClient } from "@/lib/supabase/server";
import type { FoodItem } from "./types";

/** 有効な food_table を全件取得(58品程度・sort_order順)。クライアントで検索する前提。 */
export async function getActiveFoods(): Promise<FoodItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("food_table")
    .select(
      "id, name, aliases, unit_type, base_qty, default_qty, step_qty, unit_label, kcal, protein_g, fat_g, carb_g, category, method, is_priority, count_desc, unit_grams"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    aliases: (r.aliases as string[] | null) ?? [],
    unitType: (r.unit_type as "weight" | "count") ?? "weight",
    baseQty: Number(r.base_qty ?? 100),
    defaultQty: Number(r.default_qty ?? 100),
    stepQty: Number(r.step_qty ?? 10),
    unitLabel: (r.unit_label as string) ?? "g",
    kcal: r.kcal != null ? Number(r.kcal) : null,
    proteinG: r.protein_g != null ? Number(r.protein_g) : null,
    fatG: r.fat_g != null ? Number(r.fat_g) : null,
    carbG: r.carb_g != null ? Number(r.carb_g) : null,
    category: (r.category as string | null) ?? null,
    method: (r.method as string | null) ?? null,
    isPriority: Boolean(r.is_priority),
    countDesc: (r.count_desc as string | null) ?? null,
    unitGrams: r.unit_grams != null ? Number(r.unit_grams) : null,
  }));
}

/** 品の内訳(材料)を取得。積算316品はここに1行以上ある(他方式は0行)。 */
export async function getFoodRecipe(foodId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("food_recipe_items")
    .select("seq, material_name, material_ref, grams, kcal, protein_g, fat_g, carb_g")
    .eq("food_id", foodId)
    .order("seq", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    seq: Number(r.seq),
    materialName: r.material_name as string,
    materialRef: (r.material_ref as string | null) ?? null,
    grams: Number(r.grams),
    kcal: r.kcal != null ? Number(r.kcal) : null,
    proteinG: r.protein_g != null ? Number(r.protein_g) : null,
    fatG: r.fat_g != null ? Number(r.fat_g) : null,
    carbG: r.carb_g != null ? Number(r.carb_g) : null,
  }));
}
