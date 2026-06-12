import { createClient } from "@/lib/supabase/server";

/**
 * 目標管理シート 状態取得 (ホーム横長ブロック用)
 *
 * - hasContent     : 目標シートが存在するか
 * - hasReviewNotice: のり氏からの添削済み (reviewed_at IS NOT NULL)
 *
 * モックの添削バッジ (メール SVG) は「添削あり/なし」のみ表示。
 * 既読/未読管理テーブルがないので未読数表示は Phase 4 に正直に先送り。
 * (「嘘の数字は出さない」原則)
 */

export type GoalSheetStatus = {
  hasContent: boolean;
  hasReviewNotice: boolean;
};

export async function getMyGoalSheetStatus(): Promise<GoalSheetStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasContent: false, hasReviewNotice: false };

  const { data } = await supabase
    .from("goal_sheets")
    .select("reviewed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { hasContent: false, hasReviewNotice: false };
  return {
    hasContent: true,
    hasReviewNotice: data.reviewed_at !== null,
  };
}
