import { createClient } from "@/lib/supabase/server";
import type {
  Alcohol,
  Bowel,
  Condition,
  DailyConditionData,
} from "./types";

/** 生活記録(P6)の受講生側クエリ(server)。 */

/** 指定日の生活記録。行が無ければ null(未対応)。全null行=スキップ済み(対応済み)。 */
export async function getDailyCondition(
  date: string
): Promise<{ recorded: boolean; data: DailyConditionData } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("daily_conditions")
    .select("sleep_hours, condition, bowel, alcohol")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();
  if (!data) return null;
  return {
    recorded: true,
    data: {
      sleepHours: (data.sleep_hours as number | null) ?? null,
      condition: (data.condition as Condition | null) ?? null,
      bowel: (data.bowel as Bowel | null) ?? null,
      alcohol: (data.alcohol as Alcohol | null) ?? null,
    },
  };
}

/**
 * 翌日補完の判定: 指定日(通常=昨日)に生活記録が無く、かつその日に何か記録(食事)があるか。
 * true = 「昨日の調子を聞く」プロンプトを出す候補。
 */
export async function shouldAskYesterday(yesterday: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const [{ data: cond }, { data: meals }] = await Promise.all([
    supabase
      .from("daily_conditions")
      .select("date")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .limit(1),
  ]);
  return !cond && (meals?.length ?? 0) > 0;
}

/** 複数日(週先読み用)の生活記録を一括で返す。行が無い日はキーごと欠落。 */
export async function getDailyConditions(
  dates: string[]
): Promise<Record<string, DailyConditionData>> {
  const out: Record<string, DailyConditionData> = {};
  if (dates.length === 0) return out;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return out;

  const { data } = await supabase
    .from("daily_conditions")
    .select("date, sleep_hours, condition, bowel, alcohol")
    .eq("user_id", user.id)
    .in("date", dates);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    out[row.date as string] = {
      sleepHours: (row.sleep_hours as number | null) ?? null,
      condition: (row.condition as Condition | null) ?? null,
      bowel: (row.bowel as Bowel | null) ?? null,
      alcohol: (row.alcohol as Alcohol | null) ?? null,
    };
  }
  return out;
}
