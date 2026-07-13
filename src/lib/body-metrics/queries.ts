import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysSinceDateJST } from "@/lib/date/jst";

export type BodyMetricRow = {
  id: string;
  user_id: string;
  recorded_at: string; // YYYY-MM-DD
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 受講生自身の体組成記録一覧 (新しい順)
 */
export async function listMyBodyMetrics(limit = 90): Promise<BodyMetricRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("body_metrics")
    .select("*")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as BodyMetricRow[];
}

/**
 * 特定ユーザーの体組成記録 (管理者用 ・ Service Role)
 */
export async function listBodyMetricsForAdmin(
  userId: string,
  limit = 90
): Promise<BodyMetricRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("body_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as BodyMetricRow[];
}

/**
 * 最新 + 7 日前と比較した変化量
 */
export type LatestWithDelta = {
  latest: BodyMetricRow | null;
  weightDelta7d: number | null;
  weightDelta30d: number | null;
  bodyFatDelta7d: number | null;
  waistDelta7d: number | null;
  daysSinceLatest: number | null;
  // まとめパネル(2026-07-13): 体重の直近3回の流れ(古→新)。既存の60件取得から切り出すだけ(新規クエリ0)。
  recentWeights: { date: string; value: number }[];
};

export async function getLatestBodyMetricSummary(
  userId: string
): Promise<LatestWithDelta> {
  const admin = createAdminClient();
  // 件4(2026-07-13・要Go-1=B): 30日差も算出するため取得を 30→60 件へ。毎日記録でも
  //   30日前の記録が窓に入るように。新規クエリは足さずこの1本の上限だけ増やす。
  const { data } = await admin
    .from("body_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as BodyMetricRow[];
  if (rows.length === 0) {
    return {
      latest: null,
      weightDelta7d: null,
      weightDelta30d: null,
      bodyFatDelta7d: null,
      waistDelta7d: null,
      daysSinceLatest: null,
      recentWeights: [],
    };
  }

  // 直近3回の体重(古い順・重量ありのみ)。
  const recentWeights = rows
    .filter((r) => r.weight_kg != null)
    .slice(0, 3)
    .map((r) => ({ date: r.recorded_at, value: r.weight_kg as number }))
    .reverse();

  const latest = rows[0];
  const latestDate = new Date(latest.recorded_at);
  // ③ JST基準の暦日差（UTC解釈で「◯日ぶり」が深夜にズレるのを防ぐ）
  const daysSinceLatest = daysSinceDateJST(latest.recorded_at);

  // N 日前以上前の最も近い記録を探す(なければ null)
  const nearestBefore = (days: number): BodyMetricRow | undefined => {
    const cutoff = new Date(latestDate);
    cutoff.setDate(cutoff.getDate() - days);
    return rows.find((r) => new Date(r.recorded_at).getTime() <= cutoff.getTime());
  };
  const prev7 = nearestBefore(7);
  const prev30 = nearestBefore(30);

  const delta = (a: number | null, b: number | null): number | null =>
    a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null;

  return {
    latest,
    weightDelta7d: prev7 ? delta(latest.weight_kg, prev7.weight_kg) : null,
    weightDelta30d: prev30 ? delta(latest.weight_kg, prev30.weight_kg) : null,
    bodyFatDelta7d: prev7 ? delta(latest.body_fat_percent, prev7.body_fat_percent) : null,
    waistDelta7d: prev7 ? delta(latest.waist_cm, prev7.waist_cm) : null,
    daysSinceLatest,
    recentWeights,
  };
}
