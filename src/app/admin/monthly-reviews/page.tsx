import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listPendingAudits,
  listAllAudits,
} from "@/lib/monthly-audit/queries";
import { type MonthlyAuditRow } from "@/lib/monthly-audit/types";
import { InboxClient, type InboxAudit } from "./InboxClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 月次添削 受信箱 (/admin/monthly-reviews)
 *
 * 設計元: /tmp/admin_monthly_inbox.html (Phase 2-7 モック)
 *
 * 役割:
 *   - 未返答リスト (提出済 + 動画未配信、古い順 FIFO)
 *   - 返答済リスト (最近 10 件、薄表示)
 *   - 受講生名検索 + フィルタタブ (Client Component)
 *   - 各行クリックで個別作業画面 (/admin/monthly-reviews/[id]) へ遷移
 *
 * アクセス制御:
 *   - 管理者のみ (requireAdmin で未ログイン/非管理者は自動リダイレクト)
 */
export default async function AdminMonthlyReviewInboxPage() {
  const admin = await requireAdmin();

  const pending = await listPendingAudits();
  const allAudits = await listAllAudits(50);
  const replied = allAudits
    .filter((a) => a.nori_video_published_at !== null)
    .slice(0, 10);

  const userIds = [
    ...new Set([...pending, ...replied].map((a) => a.user_id)),
  ];
  const [usersMap, replyCountMap] = await Promise.all([
    fetchUsersMap(userIds),
    fetchReplyCountMap(userIds),
  ]);

  const toInboxAudit = (audit: MonthlyAuditRow): InboxAudit => {
    const submittedAt = audit.submitted_at ? new Date(audit.submitted_at) : null;
    const publishedAt = audit.nori_video_published_at
      ? new Date(audit.nori_video_published_at)
      : null;
    const daysSinceSubmit = submittedAt
      ? Math.floor((Date.now() - submittedAt.getTime()) / 86_400_000)
      : 0;
    const user = usersMap.get(audit.user_id);
    return {
      id: audit.id,
      userName: user?.name ?? "(不明)",
      joinedAtLabel: user?.joinedAt ? formatJoinedAt(user.joinedAt) : "—",
      replyCount: replyCountMap.get(audit.user_id) ?? 0,
      submittedDateLabel: submittedAt ? formatDate(submittedAt) : null,
      publishedDateLabel: publishedAt ? formatDate(publishedAt) : null,
      videoDurationLabel: audit.nori_video_duration_sec
        ? formatDuration(audit.nori_video_duration_sec)
        : null,
      daysSinceSubmit,
    };
  };

  const pendingInbox = pending.map(toInboxAudit);
  const repliedInbox = replied.map(toInboxAudit);

  // 今月の進捗バー用集計
  const supabase = createAdminClient();
  const targetMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const [usersCount, completedCount] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("monthly_audits")
      .select("id", { count: "exact", head: true })
      .eq("target_month", targetMonth)
      .not("nori_video_published_at", "is", null),
  ]);

  return (
    <InboxClient
      pending={pendingInbox}
      replied={repliedInbox}
      adminName={admin.name}
      adminInitial={admin.name.charAt(0)}
      thisMonthCompleted={completedCount.count ?? 0}
      thisMonthTotal={usersCount.count ?? 0}
    />
  );
}

// =====================================================================
// 補助関数
// =====================================================================

function formatJoinedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function fetchUsersMap(
  userIds: string[]
): Promise<Map<string, { name: string; joinedAt: string | null }>> {
  const map = new Map<string, { name: string; joinedAt: string | null }>();
  if (userIds.length === 0) return map;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, nickname, joined_at, created_at")
    .in("id", userIds);
  (data ?? []).forEach((u) => {
    const name = (u.nickname as string | null) || (u.name as string);
    const joinedAt =
      (u.joined_at as string | null) ?? (u.created_at as string | null);
    map.set(u.id as string, { name, joinedAt });
  });
  return map;
}

async function fetchReplyCountMap(
  userIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select("user_id")
    .in("user_id", userIds)
    .not("nori_video_published_at", "is", null);
  (data ?? []).forEach((r) => {
    const uid = r.user_id as string;
    map.set(uid, (map.get(uid) ?? 0) + 1);
  });
  return map;
}
