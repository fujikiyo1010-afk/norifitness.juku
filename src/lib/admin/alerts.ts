import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 管理画面 アラートタグ集計
 *
 * 仕様: docs/00_premises/admin_alert_tags_spec_2026-06-11.md
 *
 * 8 種のうち 6 種を実装、 2 種は体組成 DB 未実装のため TODO スタブ:
 *   ✅ monthly_overdue_soon / monthly_overdue (月次未提出)
 *   ✅ carte_blank (カルテ未記入)
 *   ✅ goal_sheet_blank (目標シート空)
 *   ✅ long_no_login (最終ログイン放置)
 *   ✅ no_learning (学習未着手)
 *   ⏳ body_metrics_stalled (体組成 N 日途絶) - 体組成 DB 未実装
 *   ⏳ goal_deviation (目標乖離) - 体組成 DB 未実装
 *
 * 閾値はコード直書き (Phase 4 で /admin/settings/alerts から変更可能化予定)
 */

// =====================================================================
// 型定義
// =====================================================================

export type AlertSeverity = "urgent" | "warn";

export type AlertTagKey =
  | "monthly_overdue_soon"
  | "monthly_overdue"
  | "body_metrics_stalled"
  | "goal_deviation"
  | "carte_blank"
  | "goal_sheet_blank"
  | "long_no_login"
  | "no_learning"
  | "goal_sheet_review_requested";

export type AlertTag = {
  key: AlertTagKey;
  label: string;
  severity: AlertSeverity;
};

export type UserWithAlerts = {
  userId: string;
  userName: string;
  joinedAt: string;
  tags: AlertTag[];
  /** 一番強い重要度 (urgent > warn > null) */
  topSeverity: AlertSeverity | null;
};

// =====================================================================
// 閾値 (Phase 4 で設定化予定)
// =====================================================================

export const ALERT_THRESHOLDS = {
  /** 月次未提出: 期限 N 日前から警告 */
  MONTHLY_OVERDUE_SOON_DAYS: 3,
  /** 体組成: N 日記録なしで警告 */
  BODY_METRICS_STALLED_DAYS: 7,
  /** 目標乖離: N % で警告 */
  GOAL_DEVIATION_PERCENT: 7,
  /** カルテ未記入: 入塾後 N 日経過で警告 */
  CARTE_BLANK_DAYS: 3,
  /** 目標シート空: 入塾後 N 日経過で警告 */
  GOAL_SHEET_BLANK_DAYS: 7,
  /** 最終ログイン: N 日前で警告 */
  NO_LOGIN_DAYS: 7,
  /** 学習未着手: 入塾後 N 日経過で警告 */
  NO_LEARNING_DAYS: 14,
} as const;

// =====================================================================
// 日数差ヘルパー
// =====================================================================

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * target_month (YYYY-MM-01) から「その月の月末」= 期限を計算。
 * TODO: 別途 deadline カラムが追加されたらそちらを優先する。
 */
function monthEndOf(targetMonth: string): Date {
  const date = new Date(targetMonth);
  // 翌月の 1 日の 1 日前 = 当月末
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// =====================================================================
// メイン集計関数
// =====================================================================

/**
 * 全受講生のアラートタグを集計する。
 * ホームダッシュボードの「今すぐ対応 / 今日中に確認」用。
 *
 * Service Role で取得 (RLS 経由しない管理者専用集計)
 */
export async function listUsersWithAlerts(): Promise<UserWithAlerts[]> {
  const admin = createAdminClient();
  const now = new Date();

  // 受講生一覧
  const { data: users } = await admin
    .from("users")
    .select("id, name, joined_at")
    .order("joined_at", { ascending: false });

  if (!users || users.length === 0) return [];

  // 関連データを並列取得
  const [
    audits,
    cartes,
    sheets,
    lessons,
    authList,
    bodyMetrics,
    sheetsWithContent,
    sheetsForReviewRequest,
  ] = await Promise.all([
    admin.from("monthly_audits").select("user_id, target_month, submitted_at"),
    admin.from("user_workout_carte").select("user_id, purposes"),
    admin.from("goal_sheets").select("user_id"),
    admin.from("lesson_progress").select("user_id").eq("is_completed", true),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("body_metrics")
      .select("user_id, recorded_at, weight_kg")
      .order("recorded_at", { ascending: false }),
    admin.from("goal_sheets").select("user_id, content"),
    admin
      .from("goal_sheets")
      .select("user_id, last_review_requested_at, reviewed_at"),
  ]);

  // 高速ルックアップ用の Set / Map
  const carteUserIds = new Set(cartes.data?.map((c) => c.user_id) ?? []);
  // ダイエット目的かどうか (goal_deviation アラート対象判定用)
  // ダイエット系の目的 (ダイエット / 見た目改善) を持つ受講生のみ体重乖離を警告
  const isDietGoalByUser = new Map<string, boolean>();
  for (const c of cartes.data ?? []) {
    const purposes = (c.purposes as string[] | null) ?? [];
    const isDiet = purposes.some(
      (p) => p === "ダイエット" || p === "見た目改善"
    );
    isDietGoalByUser.set(c.user_id, isDiet);
  }
  const sheetUserIds = new Set(sheets.data?.map((s) => s.user_id) ?? []);
  const learningUserIds = new Set(lessons.data?.map((l) => l.user_id) ?? []);
  const lastLoginByUser = new Map<string, Date>();
  for (const u of authList.data?.users ?? []) {
    if (u.last_sign_in_at) {
      lastLoginByUser.set(u.id, new Date(u.last_sign_in_at));
    }
  }
  // ユーザーごとの月次提出状況 (target_month 降順、 未提出を優先)
  const auditsByUser = new Map<string, { target_month: string; submitted_at: string | null }[]>();
  for (const a of audits.data ?? []) {
    const arr = auditsByUser.get(a.user_id) ?? [];
    arr.push({ target_month: a.target_month as string, submitted_at: a.submitted_at as string | null });
    auditsByUser.set(a.user_id, arr);
  }

  // body_metrics: ユーザーごとに最新記録日 + 最新体重
  const bodyMetricsByUser = new Map<
    string,
    { latestDate: Date; latestWeight: number | null }
  >();
  for (const m of bodyMetrics.data ?? []) {
    const existing = bodyMetricsByUser.get(m.user_id);
    const date = new Date(m.recorded_at as string);
    if (!existing || date > existing.latestDate) {
      bodyMetricsByUser.set(m.user_id, {
        latestDate: date,
        latestWeight: m.weight_kg as number | null,
      });
    }
  }

  // goal_sheets: ユーザーごとに目標体重 (kg)
  const targetWeightByUser = new Map<string, number>();
  for (const g of sheetsWithContent.data ?? []) {
    const content = g.content as
      | { goal_selection?: { target_weight_kg?: number } }
      | null;
    const target = content?.goal_selection?.target_weight_kg;
    if (target && target > 0) targetWeightByUser.set(g.user_id, target);
  }

  // goal_sheets: 再添削依頼が反映済より新しい受講生 Set 化
  // (= last_review_requested_at > reviewed_at の受講生 = 管理者対応待ち)
  // Phase 4 #16 線① 前倒し (2026-06-16)
  const reviewRequestedUserIds = new Set<string>();
  for (const g of sheetsForReviewRequest.data ?? []) {
    const requestedAt = g.last_review_requested_at as string | null;
    const reviewedAt = g.reviewed_at as string | null;
    if (!requestedAt) continue;
    if (!reviewedAt || new Date(requestedAt) > new Date(reviewedAt)) {
      reviewRequestedUserIds.add(g.user_id);
    }
  }

  return users.map((user) => {
    const tags: AlertTag[] = [];
    const joinedAt = new Date(user.joined_at);
    const daysSinceJoined = daysBetween(joinedAt, now);

    // 1-2. 月次未提出 (期限間近 / 期限後)
    // 当月分または直近の未提出月次を探す
    const userAudits = auditsByUser.get(user.id) ?? [];
    const pendingAudit = userAudits
      .filter((a) => !a.submitted_at)
      .sort((a, b) => (a.target_month > b.target_month ? -1 : 1))[0];

    if (pendingAudit) {
      const deadline = monthEndOf(pendingAudit.target_month);
      const daysUntilDeadline = daysBetween(now, deadline);
      if (daysUntilDeadline < 0) {
        tags.push({
          key: "monthly_overdue",
          label: `月次未提出 (期限超過 ${Math.abs(daysUntilDeadline)} 日)`,
          severity: "urgent",
        });
      } else if (daysUntilDeadline <= ALERT_THRESHOLDS.MONTHLY_OVERDUE_SOON_DAYS) {
        tags.push({
          key: "monthly_overdue_soon",
          label: `月次未提出 (期限 ${daysUntilDeadline} 日前)`,
          severity: "urgent",
        });
      }
    }

    // 3. 体組成 N 日途絶
    const bm = bodyMetricsByUser.get(user.id);
    if (bm) {
      const daysSinceLatest = daysBetween(bm.latestDate, now);
      if (daysSinceLatest >= ALERT_THRESHOLDS.BODY_METRICS_STALLED_DAYS) {
        tags.push({
          key: "body_metrics_stalled",
          label: `体組成 ${daysSinceLatest} 日途絶`,
          severity: "warn",
        });
      }
    }

    // 4. 目標乖離 (体重 vs 目標体重)
    //
    // ⚠️ 暫定実装 (2026-06-11 v5):
    //   - 体重ベースの判定のため、 ダイエット系目的者のみ対象
    //   - カルテの purposes に「ダイエット」または「見た目改善」を含む場合のみ判定
    //   - 筋肉増 / 健康維持 / 体力向上が目的の受講生では誤作動するため除外
    //   - KPI 本体 (実施完工率) には昇格させない (社長確認待ち)
    const target = targetWeightByUser.get(user.id);
    const isDietGoal = isDietGoalByUser.get(user.id) ?? false;
    if (isDietGoal && bm?.latestWeight && target) {
      const deviation = Math.abs(((bm.latestWeight - target) / target) * 100);
      if (deviation >= ALERT_THRESHOLDS.GOAL_DEVIATION_PERCENT) {
        tags.push({
          key: "goal_deviation",
          label: `目標乖離 ${deviation.toFixed(0)}%`,
          severity: "urgent",
        });
      }
    }

    // 5. カルテ未記入
    if (!carteUserIds.has(user.id) && daysSinceJoined >= ALERT_THRESHOLDS.CARTE_BLANK_DAYS) {
      tags.push({
        key: "carte_blank",
        label: "カルテ未記入",
        severity: "urgent",
      });
    }

    // 6. 目標シート空
    if (!sheetUserIds.has(user.id) && daysSinceJoined >= ALERT_THRESHOLDS.GOAL_SHEET_BLANK_DAYS) {
      tags.push({
        key: "goal_sheet_blank",
        label: "目標シート空",
        severity: "warn",
      });
    }

    // 7. 最終ログイン
    const lastLogin = lastLoginByUser.get(user.id);
    if (lastLogin) {
      const daysSinceLogin = daysBetween(lastLogin, now);
      if (daysSinceLogin >= ALERT_THRESHOLDS.NO_LOGIN_DAYS) {
        tags.push({
          key: "long_no_login",
          label: `最終ログイン ${daysSinceLogin} 日前`,
          severity: "warn",
        });
      }
    }

    // 8. 学習未着手
    if (!learningUserIds.has(user.id) && daysSinceJoined >= ALERT_THRESHOLDS.NO_LEARNING_DAYS) {
      tags.push({
        key: "no_learning",
        label: "学習未着手",
        severity: "warn",
      });
    }

    // 9. 目標シート 再添削依頼 (Phase 4 #16 線① 前倒し、 severity = urgent)
    if (reviewRequestedUserIds.has(user.id)) {
      tags.push({
        key: "goal_sheet_review_requested",
        label: "目標シート 再添削依頼",
        severity: "urgent",
      });
    }

    // body_metrics_stalled は「情報表示のみ」 (= 受講生自走に任せる) のため、
    // ホームダッシュ「今日中に確認」 セクションに出さない (Phase 4 #17 線① 前倒し、 2026-06-15)。
    // タグ自体は受講生一覧バッジ + 受講生ハブには表示残る (= のり氏は状況を知れる)。
    // 受講生側は src/lib/member/alerts.ts の body_metrics_stalled 黄バナーで自走を促す。
    const actionableTags = tags.filter((t) => t.key !== "body_metrics_stalled");
    const hasUrgent = actionableTags.some((t) => t.severity === "urgent");
    const topSeverity: AlertSeverity | null =
      actionableTags.length === 0 ? null : hasUrgent ? "urgent" : "warn";

    return {
      userId: user.id,
      userName: user.name,
      joinedAt: user.joined_at as string,
      tags,
      topSeverity,
    };
  });
}

/**
 * 単一受講生のアラートタグを取得 (受講生ハブ概要タブ用)
 */
export async function getUserAlerts(userId: string): Promise<AlertTag[]> {
  const all = await listUsersWithAlerts();
  return all.find((u) => u.userId === userId)?.tags ?? [];
}

/**
 * ホームダッシュボードの「今すぐ対応 / 今日中に確認」セクション用に分類。
 */
export function bucketAlertsBySeverity(usersWithAlerts: UserWithAlerts[]) {
  const urgent: UserWithAlerts[] = [];
  const warn: UserWithAlerts[] = [];
  for (const u of usersWithAlerts) {
    if (u.topSeverity === "urgent") urgent.push(u);
    else if (u.topSeverity === "warn") warn.push(u);
  }
  return { urgent, warn };
}
