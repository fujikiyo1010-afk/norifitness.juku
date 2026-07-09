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
  bodyFatDelta7d: number | null;
  waistDelta7d: number | null;
  daysSinceLatest: number | null;
};

export async function getLatestBodyMetricSummary(
  userId: string
): Promise<LatestWithDelta> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("body_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(30);

  const rows = (data ?? []) as BodyMetricRow[];
  if (rows.length === 0) {
    return {
      latest: null,
      weightDelta7d: null,
      bodyFatDelta7d: null,
      waistDelta7d: null,
      daysSinceLatest: null,
    };
  }

  const latest = rows[0];
  const latestDate = new Date(latest.recorded_at);
  // ③ JST基準の暦日差（UTC解釈で「◯日ぶり」が深夜にズレるのを防ぐ）
  const daysSinceLatest = daysSinceDateJST(latest.recorded_at);

  // 7 日前以上前の最も近い記録を探す
  const sevenDaysBefore = new Date(latestDate);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  const prev = rows.find(
    (r) => new Date(r.recorded_at).getTime() <= sevenDaysBefore.getTime()
  );

  const delta = (a: number | null, b: number | null): number | null =>
    a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null;

  return {
    latest,
    weightDelta7d: prev ? delta(latest.weight_kg, prev.weight_kg) : null,
    bodyFatDelta7d: prev ? delta(latest.body_fat_percent, prev.body_fat_percent) : null,
    waistDelta7d: prev ? delta(latest.waist_cm, prev.waist_cm) : null,
    daysSinceLatest,
  };
}
