import { createClient } from "@/lib/supabase/server";

/**
 * 受講生本人用 アラート集計 (ホーム v4 黄バナー用)
 *
 * 仕様: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 * + Phase 4 #17 体組成 7 日途絶アラート (2026-06-15 線① 前倒し ・ 受講生自走化)
 *
 * 管理者用 `lib/admin/alerts.ts` は service role で全受講生集計するが、
 * こちらは **本人セッション + RLS** で自分のデータのみ取得。
 * 安全性: 他人のデータが漏れる事故が起きない。
 *
 * 対象アラート 4 種:
 *   - carte_blank           : カルテ未記入
 *   - goal_sheet_blank      : 目標管理シート未記入
 *   - body_metrics_missing  : 体組成 記録なし (1 件も)
 *   - body_metrics_stalled  : 体組成 7 日以上記録なし (継続中の途絶)
 *
 * missing と stalled は排他関係:
 *   - body_metrics 行が 0 件 → missing
 *   - body_metrics 行が 1 件以上 + 最新 recorded_at が 7 日以上前 → stalled
 *   - body_metrics 行が 1 件以上 + 最新 recorded_at が 7 日以内 → アラートなし
 */

export type MemberAlertKey =
  | "carte_blank"
  | "goal_sheet_blank"
  | "body_metrics_missing"
  | "body_metrics_stalled"
  | "notification_off";

export type MemberAlert = {
  key: MemberAlertKey;
  /** body_metrics_stalled 用: 最後の記録からの経過日数 */
  daysSinceLatest?: number;
};

/** 体組成 N 日記録なしで「途絶」 と判定する閾値 (管理者用 admin/alerts.ts と同期) */
const BODY_METRICS_STALLED_DAYS = 7;

export async function getMyAlerts(): Promise<MemberAlert[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RLS が効くので自分の行しか返らない = .eq("user_id", user.id) は念のため
  const [carte, sheet, body, userRow, pushSub] = await Promise.all([
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
      .select("recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("email_notification_enabled")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const alerts: MemberAlert[] = [];
  if (!carte.data) alerts.push({ key: "carte_blank" });
  if (!sheet.data) alerts.push({ key: "goal_sheet_blank" });
  if (!body.data) {
    alerts.push({ key: "body_metrics_missing" });
  } else {
    const latest = new Date(body.data.recorded_at as string);
    const daysSinceLatest = Math.floor(
      (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLatest >= BODY_METRICS_STALLED_DAYS) {
      alerts.push({ key: "body_metrics_stalled", daysSinceLatest });
    }
  }

  // 通知 OFF 判定: メール通知が OFF か Push subscription が未登録なら誘導バナー表示
  // (= どちらか片方でも OFF なら出す = 「全 ON 推奨」 思想と一致)
  const emailOff = userRow.data?.email_notification_enabled === false;
  const pushOff = !pushSub.data;
  if (emailOff || pushOff) {
    alerts.push({ key: "notification_off" });
  }

  return alerts;
}
