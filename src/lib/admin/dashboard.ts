import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 管理画面 ホームダッシュボード KPI 集計
 *
 * モック仕様: docs/03_design_mocks/recovered/管理画面_ホームダッシュボード.html
 *
 * KPI 6 カード (成果 1 + 残務 5):
 *   ① 今月の月次添削 完了率 (成果カード、 ヒーロー)
 *   ② 月次添削 未送信
 *   ③ 重要アラート (urgent タグ持ち受講生数)
 *   ④ リクエスト未対応 (カルテ + メニュー)
 *   ⑤ プロテイン発送 未対応 (TODO: 発送 DB 未実装)
 *   ⑥ 新規入会 未処理 (TODO: 招待バックログから集計)
 */

export type DashboardKPI = {
  totalUsers: number;
  /** 今月の月次添削 完了数 (のり氏返信済) */
  thisMonthAuditsCompleted: number;
  /** 今月の月次添削 全受講生数 (= 完了率の母数) */
  thisMonthAuditsTotal: number;
  /** 月次添削 未送信 (提出済かつ未返信) */
  pendingAudits: number;
  /** カルテ更新 + メニュー変更 リクエスト未対応 */
  pendingRequests: number;
  /** プロテイン発送 未対応 (TODO: 発送 DB 未実装) */
  pendingShipments: number;
  /** 新規入会 未処理 (招待発行中) */
  pendingInvitations: number;
};

/**
 * 今月の target_month (YYYY-MM-01) を返す
 */
function currentTargetMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

export async function getDashboardKPI(): Promise<DashboardKPI> {
  const admin = createAdminClient();
  const targetMonth = currentTargetMonth();

  const [
    usersRes,
    completedRes,
    pendingAuditsRes,
    carteReqRes,
    workoutReqRes,
    inviteRes,
    pendingShipmentsRes,
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin
      .from("monthly_audits")
      .select("id", { count: "exact", head: true })
      .eq("target_month", targetMonth)
      .not("nori_video_published_at", "is", null),
    admin
      .from("monthly_audits")
      .select("id", { count: "exact", head: true })
      .not("submitted_at", "is", null)
      .is("nori_video_published_at", null),
    admin
      .from("user_carte_request")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("user_workout_request")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    admin
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    thisMonthAuditsCompleted: completedRes.count ?? 0,
    thisMonthAuditsTotal: usersRes.count ?? 0,
    pendingAudits: pendingAuditsRes.count ?? 0,
    pendingRequests: (carteReqRes.count ?? 0) + (workoutReqRes.count ?? 0),
    pendingShipments: pendingShipmentsRes.count ?? 0,
    pendingInvitations: inviteRes.count ?? 0,
  };
}
