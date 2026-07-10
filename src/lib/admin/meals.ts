import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 管理: ユーザーハブ「食事記録」タブ(M3/M4)のデータ。
 * 直近の食事を日別にまとめ、各日にその日のデイリーFBを添える(履歴閲覧)。
 * service role で取得(管理は全件select可)。
 */

export type AdminMealEntry = {
  mealType: string; // 朝/昼/夕/間
  postedAt: string;
  memo: string | null;
  items: string[];
  photoUrls: string[];
};

export type AdminMealDay = {
  date: string;
  meals: AdminMealEntry[];
  feedback: string | null; // その日のデイリーFB(sent)
};

const MEAL_ORDER: Record<string, number> = { 朝: 0, 昼: 1, 夕: 2, 間: 3 };

/** ユーザーの直近 limitDays 日ぶんの食事を日別に(新しい順) */
export async function getMealDaysForUser(
  userId: string,
  limitDays = 30
): Promise<AdminMealDay[]> {
  const admin = createAdminClient();

  const { data: logRows } = await admin
    .from("meal_logs")
    .select("id, date, meal_type, posted_at, memo, photos")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("posted_at", { ascending: true })
    .limit(limitDays * 6);
  const logs = (logRows ?? []) as {
    id: string;
    date: string;
    meal_type: string;
    posted_at: string;
    memo: string | null;
    photos: string[] | null;
  }[];
  if (logs.length === 0) return [];

  // 品目
  const { data: itemRows } = await admin
    .from("meal_log_items")
    .select("meal_log_id, name, sort_order")
    .in(
      "meal_log_id",
      logs.map((l) => l.id)
    )
    .order("sort_order", { ascending: true });
  const itemsByLog = new Map<string, string[]>();
  for (const it of (itemRows ?? []) as { meal_log_id: string; name: string }[]) {
    const arr = itemsByLog.get(it.meal_log_id) ?? [];
    arr.push(it.name);
    itemsByLog.set(it.meal_log_id, arr);
  }

  // 署名URL
  const allPaths = logs.flatMap((l) => l.photos ?? []);
  const urlByPath = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await admin.storage
      .from("meal-photos")
      .createSignedUrls(allPaths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    }
  }

  // その期間のFB
  const dates = Array.from(new Set(logs.map((l) => l.date)));
  const { data: fbRows } = await admin
    .from("daily_feedbacks")
    .select("date, body, status")
    .eq("user_id", userId)
    .in("date", dates);
  const fbByDate = new Map<string, string>();
  for (const f of (fbRows ?? []) as {
    date: string;
    body: string | null;
    status: string;
  }[]) {
    if (f.status === "sent" && f.body) fbByDate.set(f.date, f.body);
  }

  // 日別にまとめ
  const byDate = new Map<string, AdminMealEntry[]>();
  for (const l of logs) {
    const arr = byDate.get(l.date) ?? [];
    arr.push({
      mealType: l.meal_type,
      postedAt: l.posted_at,
      memo: l.memo,
      items: itemsByLog.get(l.id) ?? [],
      photoUrls: (l.photos ?? []).map((p) => urlByPath.get(p) ?? "").filter(Boolean),
    });
    byDate.set(l.date, arr);
  }

  return Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, meals]) => ({
      date,
      meals: meals.sort(
        (a, b) =>
          (MEAL_ORDER[a.mealType] ?? 9) - (MEAL_ORDER[b.mealType] ?? 9) ||
          a.postedAt.localeCompare(b.postedAt)
      ),
      feedback: fbByDate.get(date) ?? null,
    }));
}
