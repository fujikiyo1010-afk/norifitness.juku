"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; message: string };

export type BodyMetricInput = {
  recorded_at: string; // YYYY-MM-DD
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  note: string | null;
};

/**
 * 体組成記録を upsert (同日記録は上書き)
 */
export async function upsertBodyMetric(input: BodyMetricInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  // バリデーション
  if (!input.recorded_at) {
    return { ok: false, message: "記録日を指定してください" };
  }
  if (
    input.weight_kg === null &&
    input.body_fat_percent === null &&
    input.waist_cm === null
  ) {
    return { ok: false, message: "少なくとも 1 項目を入力してください" };
  }
  if (input.weight_kg !== null && (input.weight_kg < 20 || input.weight_kg > 200)) {
    return { ok: false, message: "体重は 20-200 kg の範囲で入力してください" };
  }
  if (
    input.body_fat_percent !== null &&
    (input.body_fat_percent < 1 || input.body_fat_percent > 70)
  ) {
    return { ok: false, message: "体脂肪率は 1-70 % の範囲で入力してください" };
  }
  if (input.waist_cm !== null && (input.waist_cm < 40 || input.waist_cm > 200)) {
    return { ok: false, message: "ウエストは 40-200 cm の範囲で入力してください" };
  }

  const { error } = await supabase.from("body_metrics").upsert(
    {
      user_id: user.id,
      recorded_at: input.recorded_at,
      weight_kg: input.weight_kg,
      body_fat_percent: input.body_fat_percent,
      waist_cm: input.waist_cm,
      note: input.note,
    },
    { onConflict: "user_id,recorded_at" }
  );

  if (error) return { ok: false, message: `保存エラー: ${error.message}` };

  revalidatePath("/record");
  revalidatePath("/"); // ホーム体組成カード
  // 管理画面側も更新 (受講生ハブ /metrics タブ + ホーム KPI + アラート集計)
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 体組成記録を削除
 */
export async function deleteBodyMetric(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  const { error } = await supabase
    .from("body_metrics")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: `削除エラー: ${error.message}` };

  revalidatePath("/body-metrics");
  revalidatePath("/body-metrics/chart");
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin");
  return { ok: true };
}
