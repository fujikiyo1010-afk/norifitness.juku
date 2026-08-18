/**
 * 食事(P4)のクライアント安全な型・定数・純関数。
 * server専用(next/headers)を含まないので、クライアント component から import 可。
 */

export type MealType = "朝" | "昼" | "夕" | "間";
export const MEAL_TYPES: MealType[] = ["朝", "昼", "夕", "間"];
export const MEAL_ORDER: Record<MealType, number> = { 朝: 0, 昼: 1, 夕: 2, 間: 3 };
export const MEAL_LABEL: Record<MealType, string> = {
  朝: "朝食",
  昼: "昼食",
  夕: "夕食",
  間: "間食",
};

export type MealItem = {
  id: string;
  name: string;
  source: "table" | "built" | "manual" | "none";
  grams: number | null;
  recipe_snapshot: RecipeSnapshotItem[] | null;
  food_table_id: string | null;
  quantity: number | null;
  unit: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  sort_order: number;
};

export type MealLog = {
  id: string;
  date: string;
  meal_type: MealType;
  posted_at: string;
  memo: string | null;
  photos: string[];
  items: MealItem[];
};

// food_table(のり監修成分表・P4-b)のクライアント安全な型・計算
export type FoodItem = {
  id: string;
  name: string;
  aliases: string[];
  unitType: "weight" | "count";
  baseQty: number; // weight=100 / count=1
  defaultQty: number;
  stepQty: number; // weight=10 / count=1
  unitLabel: string;
  kcal: number | null; // base_qtyあたり
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
  category: string | null;
  method: string | null; // 数値ソース(転記/積算/市販平均 等)
  isPriority: boolean;
  countDesc: string | null; // 数え方の説明
  unitGrams: number | null; // 1単位(base_qty)の目安グラム
};

/** 内訳(材料)1行。food_recipe_items の行、および記録時のスナップショット。 */
export type RecipeItem = {
  seq: number;
  materialName: string;
  materialRef: string | null; // 成分表の食品番号 or (手動)
  grams: number;
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
};

/** meal_log_items.recipe_snapshot(JSONB)の1要素(保存形はスネークケース) */
export type RecipeSnapshotItem = {
  name: string;
  grams: number;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
};

/** かな正規化(カタカナ→ひらがな・空白除去・小文字化)。777品検索の共通則 */
export function kanaNorm(s: string): string {
  return (s || "")
    .normalize("NFKC")
    .replace(/[\s・]/g, "")
    .replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60))
    .toLowerCase();
}

/** food_table値 × 数量 で栄養を算出(base_qtyあたり→実量) */
export function calcNutrition(
  food: FoodItem,
  quantity: number
): { kcal: number | null; p: number | null; f: number | null; c: number | null } {
  const base = food.baseQty || 1;
  const scale = quantity / base;
  const r = (v: number | null) => (v == null ? null : Math.round(v * scale * 10) / 10);
  return { kcal: r(food.kcal), p: r(food.proteinG), f: r(food.fatG), c: r(food.carbG) };
}

/** かな・別名を含めた検索(777品対応: かな正規化・上位20件) */
export function searchFoods(foods: FoodItem[], q: string): FoodItem[] {
  const s = kanaNorm(q);
  if (!s) return [];
  return foods
    .filter(
      (f) =>
        kanaNorm(f.name).includes(s) ||
        f.aliases.some((a) => kanaNorm(a).includes(s))
    )
    .slice(0, 20);
}

/** 数値のある品目だけを合計(数値なし品目数も返す) */
export function sumMeals(logs: MealLog[]): {
  kcal: number;
  p: number;
  f: number;
  c: number;
  numberedCount: number;
  noValueCount: number;
} {
  let kcal = 0,
    p = 0,
    f = 0,
    c = 0,
    numberedCount = 0,
    noValueCount = 0;
  for (const log of logs) {
    for (const it of log.items) {
      if (it.kcal != null || it.protein_g != null || it.fat_g != null || it.carb_g != null) {
        kcal += it.kcal ?? 0;
        p += it.protein_g ?? 0;
        f += it.fat_g ?? 0;
        c += it.carb_g ?? 0;
        numberedCount++;
      } else {
        noValueCount++;
      }
    }
  }
  return {
    kcal: Math.round(kcal),
    p: Math.round(p),
    f: Math.round(f),
    c: Math.round(c),
    numberedCount,
    noValueCount,
  };
}
