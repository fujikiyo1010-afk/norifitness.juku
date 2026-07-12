import { createAdminClient } from "@/lib/supabase/admin";
import { daysSinceDateJST, daysSinceTsJST } from "@/lib/date/jst";

/**
 * 管理画面 アラートタグ集計
 *
 * 仕様: docs/00_premises/admin_alert_tags_spec_2026-06-11.md
 *       (2026-06-30 きよむさん指示で「目標乖離」を廃止 →「体重増加」に置換 ・ 閾値見直し)
 *
 * 実装中のアラート:
 *   ✅ monthly_overdue_soon / monthly_overdue (月次未提出)
 *   ✅ carte_blank (カルテ未記入 ・ 入塾翌日=1日で urgent)
 *   ✅ goal_sheet_blank (目標シート空 ・ 入塾3日で warn)
 *   ✅ weight_gain (体重増加 ・ ベスト〔最低〕記録から +3kg で warn)
 *   ✅ body_metrics_stalled (体組成 5日記録なし / 未記入は入会5日 ・ warn)
 *   ✅ long_no_login (最終利用 7日放置 ・ warn)
 *   ✅ no_learning (学習 14日未着手 ・ warn)
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
  | "weight_gain"
  | "carte_blank"
  | "goal_sheet_blank"
  | "long_no_login"
  | "no_learning";

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
  /** 体重増加: ベスト(最低)記録から N kg 増で警告 */
  WEIGHT_GAIN_KG: 3,
  /** 体組成: 最新記録から N 日 (未記入は入会から N 日) で警告 */
  BODY_METRICS_OVERDUE_DAYS: 5,
  /** カルテ未記入: 入塾後 N 日経過で警告 (= 翌日) */
  CARTE_BLANK_DAYS: 1,
  /** 目標シート空: 入塾後 N 日経過で警告 */
  GOAL_SHEET_BLANK_DAYS: 3,
  /** 最終利用: N 日前で警告(last_sign_in_at と last_seen_at の新しい方) */
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

  // 受講生一覧(ア1: 退塾者を除外＝在籍中 status='active' のみ)
  const { data: allUsers } = await admin
    .from("users")
    .select("id, name, joined_at, last_seen_at")
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  if (!allUsers || allUsers.length === 0) return [];

  // 関連データを並列取得
  const [audits, cartes, sheets, lessons, authList, bodyMetrics, adminRows] =
    await Promise.all([
      admin.from("monthly_audits").select("user_id, target_month, submitted_at"),
      admin.from("user_workout_carte").select("user_id"),
      admin.from("goal_sheets").select("user_id"),
      // ア3: 「未着手」は完了0件でなく着手(lesson_progressの行)0件で判定する
      admin.from("lesson_progress").select("user_id"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin
        .from("body_metrics")
        .select("user_id, recorded_at, weight_kg")
        .order("recorded_at", { ascending: false }),
      // ア1: 管理者ロールは受講生集計から除外(テスト垢がprodに現れても除外)
      admin.from("admin_users").select("id"),
    ]);

  // ア1: 管理者を受講生一覧から除外
  const adminIds = new Set((adminRows.data ?? []).map((a) => a.id as string));
  const users = allUsers.filter((u) => !adminIds.has(u.id));
  if (users.length === 0) return [];

  // 高速ルックアップ用の Set / Map
  const carteUserIds = new Set(cartes.data?.map((c) => c.user_id) ?? []);
  const sheetUserIds = new Set(sheets.data?.map((s) => s.user_id) ?? []);
  const learningUserIds = new Set(lessons.data?.map((l) => l.user_id) ?? []);
  // C: 最終利用 = max(last_sign_in_at[認証], last_seen_at[アプリを開いた点])。
  // アプリを開いただけでは last_sign_in_at は更新されないため、両者の新しい方を採る。
  const lastActivityByUser = new Map<string, Date>();
  const bumpActivity = (id: string, ts: string | null | undefined) => {
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const cur = lastActivityByUser.get(id);
    if (!cur || d > cur) lastActivityByUser.set(id, d);
  };
  for (const u of authList.data?.users ?? []) bumpActivity(u.id, u.last_sign_in_at);
  for (const u of users) bumpActivity(u.id, (u as { last_seen_at?: string | null }).last_seen_at);
  // ユーザーごとの月次提出状況 (target_month 降順、 未提出を優先)
  const auditsByUser = new Map<string, { target_month: string; submitted_at: string | null }[]>();
  for (const a of audits.data ?? []) {
    const arr = auditsByUser.get(a.user_id) ?? [];
    arr.push({ target_month: a.target_month as string, submitted_at: a.submitted_at as string | null });
    auditsByUser.set(a.user_id, arr);
  }

  // body_metrics: ユーザーごとに「最新記録日」「最新体重」「最低体重(ベスト)」
  const bodyMetricsByUser = new Map<
    string,
    { latestDate: Date; latestDateStr: string; latestWeight: number | null; minWeight: number | null }
  >();
  for (const m of bodyMetrics.data ?? []) {
    const recordedAt = m.recorded_at as string;
    const date = new Date(recordedAt);
    const w = m.weight_kg as number | null;
    const existing = bodyMetricsByUser.get(m.user_id);
    if (!existing) {
      bodyMetricsByUser.set(m.user_id, {
        latestDate: date,
        latestDateStr: recordedAt,
        latestWeight: w,
        minWeight: w,
      });
    } else {
      if (date > existing.latestDate) {
        existing.latestDate = date;
        existing.latestDateStr = recordedAt;
        existing.latestWeight = w;
      }
      if (w != null && (existing.minWeight == null || w < existing.minWeight)) {
        existing.minWeight = w;
      }
    }
  }

  return users.map((user) => {
    const tags: AlertTag[] = [];
    // ア2: 入会からの経過は JST暦日で数える(UTC直だと深夜に1日ズレる)
    const daysSinceJoined = daysSinceTsJST(user.joined_at as string);

    // 1-2. 月次未提出 (期限間近 / 期限後)
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

    const bm = bodyMetricsByUser.get(user.id);

    // 3. 体重増加 (ベスト〔最低〕記録から +3kg)
    //    2026-06-30 きよむ指示: 旧「目標乖離」を廃止し、シンプルに体重リバウンドを検知。
    //    全受講生対象 (目的によらない)。最低体重との差で判定 = いつでも計算可。
    if (bm?.latestWeight != null && bm.minWeight != null) {
      const gain = bm.latestWeight - bm.minWeight;
      if (gain >= ALERT_THRESHOLDS.WEIGHT_GAIN_KG) {
        tags.push({
          key: "weight_gain",
          label: `体重 +${gain.toFixed(1)}kg`,
          severity: "warn",
        });
      }
    }

    // 4. 体組成 記録なし/途絶 (最新記録が N 日以上前 ・ 未記入は入会から N 日)
    if (!bm) {
      if (daysSinceJoined >= ALERT_THRESHOLDS.BODY_METRICS_OVERDUE_DAYS) {
        tags.push({
          key: "body_metrics_stalled",
          label: "体組成 未記入",
          severity: "warn",
        });
      }
    } else {
      // ⑦ JST基準の暦日差（recorded_at は date 型 = UTC解釈で「N日記録なし」が深夜にズレるため）
      const gap = daysSinceDateJST(bm.latestDateStr);
      if (gap >= ALERT_THRESHOLDS.BODY_METRICS_OVERDUE_DAYS) {
        tags.push({
          key: "body_metrics_stalled",
          label: `体組成 ${gap} 日記録なし`,
          severity: "warn",
        });
      }
    }

    // 5. カルテ未記入 (= 翌日)
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

    // 7. 最終利用(C: last_sign_in_at と last_seen_at の新しい方・閾値7日は据え置き)
    const lastActivity = lastActivityByUser.get(user.id);
    if (lastActivity) {
      const daysSinceActivity = daysSinceTsJST(lastActivity); // ア2: JST暦日
      if (daysSinceActivity >= ALERT_THRESHOLDS.NO_LOGIN_DAYS) {
        tags.push({
          key: "long_no_login",
          label: `最終利用 ${daysSinceActivity} 日前`,
          severity: "warn",
        });
      }
    }

    // 8. 学習 記録なし(ア3: 完了0件でなく着手0件で判定)
    if (!learningUserIds.has(user.id) && daysSinceJoined >= ALERT_THRESHOLDS.NO_LEARNING_DAYS) {
      tags.push({
        key: "no_learning",
        label: "学習 記録なし",
        severity: "warn",
      });
    }

    const hasUrgent = tags.some((t) => t.severity === "urgent");
    const topSeverity: AlertSeverity | null =
      tags.length === 0 ? null : hasUrgent ? "urgent" : "warn";

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
