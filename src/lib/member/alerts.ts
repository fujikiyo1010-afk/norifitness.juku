import { createClient } from "@/lib/supabase/server";

/**
 * 受講生本人用 アラート集計 (ホーム v4 黄バナー 3 用)
 *
 * 仕様: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 *
 * 管理者用 `lib/admin/alerts.ts` は service role で全受講生集計するが、
 * こちらは **本人セッション + RLS** で自分のデータのみ取得。
 * 安全性: 他人のデータが漏れる事故が起きない。
 *
 * 対象アラート 3 種:
 *   - carte_blank          : カルテ未記入
 *   - goal_sheet_blank     : 目標管理シート未記入
 *   - body_metrics_missing : 体組成 記録なし
 */

export type MemberAlertKey =
  | "carte_blank"
  | "goal_sheet_blank"
  | "body_metrics_missing";

export async function getMyAlerts(): Promise<MemberAlertKey[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RLS が効くので自分の行しか返らない = .eq("user_id", user.id) は念のため
  const [carte, sheet, body] = await Promise.all([
    supabase
      .from("user_workout_carte")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("goal_sheets")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("body_metrics")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const alerts: MemberAlertKey[] = [];
  if (!carte.data) alerts.push("carte_blank");
  if (!sheet.data) alerts.push("goal_sheet_blank");
  if (!body.data) alerts.push("body_metrics_missing");
  return alerts;
}
