import { createClient } from "@/lib/supabase/server";
import type { ToolCalculation, ToolId } from "./types";

/**
 * 現在のユーザーの指定ツールの前回計算結果を取得。
 * 無ければ null。
 *
 * UNIQUE 制約 (user_id × tool_id) で 1 件しか保存されないので
 * maybeSingle() で取得。
 */
export async function getMyToolCalculation<I = unknown, O = unknown>(
  toolId: ToolId
): Promise<ToolCalculation<I, O> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("tool_calculations")
    .select("inputs, outputs, calculated_at")
    .eq("user_id", user.id)
    .eq("tool_id", toolId)
    .maybeSingle();

  if (!data) return null;

  return {
    inputs: data.inputs as I,
    outputs: data.outputs as O,
    calculatedAt: data.calculated_at as string,
  };
}
