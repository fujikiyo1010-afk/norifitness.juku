import { createClient } from "@/lib/supabase/server";
import {
  weightGoalProgress,
  weightPaceKgPerWeek,
} from "@/lib/body-metrics/goal-progress";

/**
 * ホーム 体組成カード用サマリ (2026-07-06 P7)
 *
 * /record 詳細画面と同じ計算 (goal-progress) を使い、ホームには要点だけ出す:
 *   - 現在体重 / 達成% / 目標まであと◯kg / 現状ペース / 最終記録からの経過日数
 *
 * 嘘の数字を出さない: 記録が無ければ hasData=false でカードは「記録を促す」表示に。
 */

export type BodyCard = {
  hasData: boolean; // 体重の記録が1件でもあるか
  currentWeight: number | null;
  startWeight: number | null;
  targetWeightKg: number | null;
  ringPct: number | null; // 入会→目標のうち達成割合 (0-100)
  remainingKg: number | null; // 目標まで(絶対値)
  reached: boolean;
  paceKgPerWeek: number | null;
  daysSinceLatest: number | null;
};

const EMPTY: BodyCard = {
  hasData: false,
  currentWeight: null,
  startWeight: null,
  targetWeightKg: null,
  ringPct: null,
  remainingKg: null,
  reached: false,
  paceKgPerWeek: null,
  daysSinceLatest: null,
};

export async function getMyBodyCard(): Promise<BodyCard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const [{ data: metricRows }, { data: goal }] = await Promise.all([
    supabase
      .from("body_metrics")
      .select("recorded_at, weight_kg")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("goal_sheets")
      .select("content")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const rows = (metricRows ?? []) as {
    recorded_at: string;
    weight_kg: number | null;
  }[];
  const weightRows = rows.filter((r) => r.weight_kg != null);
  if (weightRows.length === 0) return EMPTY;

  const targetWeightKg =
    (
      goal?.content as
        | { goal_selection?: { target_weight_kg?: number } }
        | undefined
    )?.goal_selection?.target_weight_kg ?? null;

  const startWeight = weightRows[0].weight_kg!;
  const currentWeight = weightRows[weightRows.length - 1].weight_kg!;
  const pace = weightPaceKgPerWeek(
    rows.map((r) => ({ recorded_at: r.recorded_at, weight_kg: r.weight_kg }))
  );

  const prog = weightGoalProgress(currentWeight, targetWeightKg);
  const remainingKg = prog.state === "remaining" ? prog.kg : null;
  const reached = prog.state === "reached";

  let ringPct: number | null = null;
  if (targetWeightKg != null) {
    const span = startWeight - targetWeightKg;
    if (Math.abs(span) < 0.05) {
      ringPct = currentWeight <= targetWeightKg ? 100 : 0;
    } else {
      ringPct = Math.max(
        0,
        Math.min(100, Math.round(((startWeight - currentWeight) / span) * 100))
      );
    }
  }

  const latestDate = new Date(weightRows[weightRows.length - 1].recorded_at);
  const daysSinceLatest = Math.floor(
    (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    hasData: true,
    currentWeight,
    startWeight,
    targetWeightKg,
    ringPct,
    remainingKg,
    reached,
    paceKgPerWeek: pace,
    daysSinceLatest,
  };
}
