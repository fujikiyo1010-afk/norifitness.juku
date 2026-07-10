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
  source: "table" | "manual" | "none";
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
