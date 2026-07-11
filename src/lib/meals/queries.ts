import { createClient } from "@/lib/supabase/server";
import { MEAL_ORDER, type MealItem, type MealLog } from "./types";

// クライアント安全な型/定数/純関数は types.ts に集約(再エクスポート)
export {
  MEAL_TYPES,
  MEAL_ORDER,
  MEAL_LABEL,
  sumMeals,
  type MealType,
  type MealItem,
  type MealLog,
} from "./types";

/**
 * 食事(P4-a・写真だけ運用)の受講生側クエリ(server専用)。
 *  - meal_logs = 1食1レコード(朝/昼/夕/間)。
 *  - 日合計は「数値のある品目のみ」を集計(v1-aは基本 null=写真だけ)。
 */

/** 指定日(YYYY-MM-DD)の自分の食事を、朝昼夕間→投稿時刻 順で返す(品目つき) */
export async function getMealsForDate(date: string): Promise<MealLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // S2-D: 親(meal_logs)→子(meal_log_items)の2往復を、ネストselectで1往復に。
  //   子は RLS「meal_log_items: self all」で本人が読めるため空落ちしない(前後の実データで突合)。
  //   子の並び(sort_order昇順)はJS側で行う(APIの参照テーブル指定に依存しないため)。
  const { data: logs } = await supabase
    .from("meal_logs")
    .select(
      "id, date, meal_type, posted_at, memo, photos, meal_log_items(id, name, source, food_table_id, quantity, unit, kcal, protein_g, fat_g, carb_g, sort_order)"
    )
    .eq("user_id", user.id)
    .eq("date", date)
    .order("posted_at", { ascending: true });

  const rows = (logs ?? []) as (Omit<MealLog, "items"> & {
    meal_log_items: MealItem[] | null;
  })[];
  if (rows.length === 0) return [];

  return rows
    .map((r) => {
      const { meal_log_items, ...rest } = r;
      const items = (meal_log_items ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);
      return { ...rest, photos: rest.photos ?? [], items };
    })
    .sort(
      (a, b) =>
        MEAL_ORDER[a.meal_type] - MEAL_ORDER[b.meal_type] ||
        a.posted_at.localeCompare(b.posted_at)
    );
}

/** meal-photos の署名URLを path→URL で返す(private bucket 表示用・1時間) */
export async function signMealPhotos(
  paths: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = await createClient();
  const { data: signed } = await supabase.storage
    .from("meal-photos")
    .createSignedUrls(paths, 3600);
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) map.set(s.path, s.signedUrl);
  }
  return map;
}

/** 単一の食事(編集用) */
export async function getMealLogById(id: string): Promise<MealLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: log } = await supabase
    .from("meal_logs")
    .select("id, date, meal_type, posted_at, memo, photos")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!log) return null;

  const { data: items } = await supabase
    .from("meal_log_items")
    .select(
      "id, name, source, food_table_id, quantity, unit, kcal, protein_g, fat_g, carb_g, sort_order"
    )
    .eq("meal_log_id", id)
    .order("sort_order", { ascending: true });

  return {
    ...(log as Omit<MealLog, "items">),
    photos: (log.photos as string[] | null) ?? [],
    items: (items ?? []) as MealItem[],
  };
}
