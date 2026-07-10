"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Alcohol, Bowel, Condition } from "./types";

type ActionResult = { ok: true } | { ok: false; message: string };

/** 生活記録を保存(upsert・1日1行)。スキップは全項目 null で upsert(=対応済みにして再質問を止める)。 */
export async function upsertDailyCondition(input: {
  date: string;
  sleepHours?: number | null;
  condition?: Condition | null;
  bowel?: Bowel | null;
  alcohol?: Alcohol | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  if (!input.date) return { ok: false, message: "日付が必要です" };

  const { error } = await supabase.from("daily_conditions").upsert(
    {
      user_id: user.id,
      date: input.date,
      sleep_hours: input.sleepHours ?? null,
      condition: input.condition ?? null,
      bowel: input.bowel ?? null,
      alcohol: input.alcohol ?? null,
    },
    { onConflict: "user_id,date" }
  );
  if (error) return { ok: false, message: `保存エラー: ${error.message}` };

  revalidatePath("/meals");
  revalidatePath("/");
  return { ok: true };
}
