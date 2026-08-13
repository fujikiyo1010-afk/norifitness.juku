"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * チャット「記録を引用」ピッカーのデータ(2026-07-31・段3)。
 * その受講生の直近の 食事 / 体重 を取り出し、選ぶと本文にテキスト引用として挿入する。
 * (写真つきカードは将来拡張。まずは『どの記録か』をワンタップで貼れる形。)管理のみ。
 */
export type QuoteItem = { key: string; label: string; text: string };
export type QuoteRecords = { meals: QuoteItem[]; weights: QuoteItem[] };

const MEAL_LABEL: Record<string, string> = {
  朝: "朝食",
  昼: "昼食",
  夕: "夕食",
  間: "間食",
};
function md(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export async function getRecordsForQuote(userId: string): Promise<QuoteRecords> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: meals }, { data: weights }] = await Promise.all([
    admin
      .from("meal_logs")
      .select("id, date, meal_type, meal_log_items(name, sort_order)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(15),
    admin
      .from("body_metrics")
      .select("id, recorded_at, weight_kg, waist_cm")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(15),
  ]);

  const mealRows = (meals ?? []) as {
    id: string;
    date: string;
    meal_type: string;
    meal_log_items: { name: string; sort_order: number | null }[] | null;
  }[];
  const weightRows = (weights ?? []) as {
    id: string;
    recorded_at: string;
    weight_kg: number | null;
    waist_cm: number | null;
  }[];

  return {
    meals: mealRows.map((m) => {
      const label = `${md(m.date)} ${MEAL_LABEL[m.meal_type] ?? m.meal_type}`;
      const items = (m.meal_log_items ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i) => i.name)
        .join("、");
      return {
        key: `meal:${m.id}`,
        label: `${label} ・ ${items || "(品目なし)"}`,
        text: `【記録】${label}: ${items || "(品目なし)"}`,
      };
    }),
    weights: weightRows
      .filter((w) => w.weight_kg != null)
      .map((w) => {
        const w2 = w.waist_cm != null ? ` / ウエスト ${w.waist_cm}cm` : "";
        return {
          key: `weight:${w.id}`,
          label: `${md(w.recorded_at)} ・ ${w.weight_kg}kg${
            w.waist_cm != null ? ` / W${w.waist_cm}` : ""
          }`,
          text: `【記録】${md(w.recorded_at)} 体重 ${w.weight_kg}kg${w2}`,
        };
      }),
  };
}
