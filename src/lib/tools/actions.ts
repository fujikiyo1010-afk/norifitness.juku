"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ToolId } from "./types";

/**
 * ツール計算結果を保存 (UPSERT、1 user × 1 tool = 1 件)。
 *
 * 失敗時は { success: false, error } を返す。
 * 成功時は revalidatePath で当該ツール画面を再生成 (前回値表示を更新するため)。
 */
export async function saveToolCalculation(
  toolId: ToolId,
  inputs: unknown,
  outputs: unknown
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未ログインです" };

  const { error } = await supabase.from("tool_calculations").upsert(
    {
      user_id: user.id,
      tool_id: toolId,
      inputs: inputs as object,
      outputs: outputs as object,
      calculated_at: new Date().toISOString(),
      applied_to_goal_sheet: false,
      applied_at: null,
    },
    { onConflict: "user_id,tool_id" }
  );

  if (error) {
    console.error("tool_calculations 保存失敗:", error);
    return { success: false, error: error.message };
  }

  // 該当ツール画面の Server Component を再取得させる
  const path =
    {
      body_fat: "/tools/body-fat",
      calorie: "/tools/calorie",
      diet_period: "/tools/diet-period",
      pfc_carb: "/tools/pfc-carb",
    }[toolId] ?? "/tools";
  revalidatePath(path);

  return { success: true };
}
