import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuditForAdmin,
  listPendingAudits,
} from "@/lib/monthly-audit/queries";
import {
  AUDIT_QUESTIONS,
  formatTargetMonthLabel,
  type ScoreAnswer,
  type MonthlyAuditItems,
  type MonthlyAuditRow,
} from "@/lib/monthly-audit/types";
import { DetailClient, type DetailViewData } from "./DetailClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 月次添削 個別作業 (/admin/monthly-reviews/[id])
 *
 * Server Component: データ取得 + 整形のみ。
 * UI は Client Component (DetailClient) に委譲し、4 モード切替を担う:
 *   - normal: Step 8 の通常 UI
 *   - recording_ready: 録画準備中 (Step 9a で UI スケルトン実装)
 *   - recording: 録画中 (Step 9b で実装)
 *   - preview: プレビュー (Step 9b で実装)
 */
export default async function AdminMonthlyReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  const audit = await getAuditForAdmin(id);
  if (!audit) notFound();

  const [user, pastReplied, pending] = await Promise.all([
    fetchUser(audit.user_id),
    fetchPastRepliedAudits(audit.user_id, audit.id),
    listPendingAudits(),
  ]);

  const pendingIndex = pending.findIndex((a) => a.id === audit.id);
  const remainingCount =
    pendingIndex >= 0 ? pending.length - pendingIndex - 1 : pending.length;
  const nextAuditId =
    pendingIndex >= 0 && pendingIndex < pending.length - 1
      ? pending[pendingIndex + 1].id
      : null;

  const submittedAt = audit.submitted_at ? new Date(audit.submitted_at) : null;
  const daysSinceSubmit = submittedAt
    ? Math.floor((Date.now() - submittedAt.getTime()) / 86_400_000)
    : 0;

  const data: DetailViewData = {
    audit: {
      id: audit.id,
      items: audit.items,
      targetMonth: audit.target_month,
      monthLabel: formatTargetMonthLabel(audit.target_month),
      daysSinceSubmit,
      avgScore: calcAverageScore(audit.items),
    },
    user: {
      name: user.name,
      joinedAtLabel: formatDate(user.joinedAt),
      monthsSinceJoin: monthsSinceJoin(user.joinedAt),
      initial: user.name.charAt(0),
    },
    pastReplied: pastReplied.map((p) => ({
      id: p.id,
      targetMonthLabel: p.target_month.substring(0, 7).replace("-", "/"),
      publishedDateLabel: p.nori_video_published_at
        ? new Date(p.nori_video_published_at).toLocaleDateString("ja-JP", {
            month: "2-digit",
            day: "2-digit",
          })
        : null,
      durationLabel: p.nori_video_duration_sec
        ? formatDuration(p.nori_video_duration_sec)
        : null,
    })),
    replyCount: pastReplied.length,
    remainingCount,
    nextAuditId,
    adminName: admin.name,
    adminInitial: admin.name.charAt(0),
  };

  return <DetailClient data={data} />;
}

// =====================================================================
// データ取得 + 整形補助 (Server only)
// =====================================================================

async function fetchUser(userId: string): Promise<{
  name: string;
  joinedAt: string | null;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("name, nickname, joined_at, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return { name: "(不明)", joinedAt: null };
  const name =
    (data.nickname as string | null) || (data.name as string) || "(不明)";
  const joinedAt =
    (data.joined_at as string | null) ?? (data.created_at as string | null);
  return { name, joinedAt };
}

async function fetchPastRepliedAudits(
  userId: string,
  currentAuditId: string
): Promise<MonthlyAuditRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .eq("user_id", userId)
    .neq("id", currentAuditId)
    .not("nori_video_published_at", "is", null)
    .order("target_month", { ascending: false });
  return (data ?? []) as unknown as MonthlyAuditRow[];
}

function calcAverageScore(items: MonthlyAuditItems): number | null {
  const scores: number[] = [];
  for (const q of AUDIT_QUESTIONS) {
    if (q.type !== "score") continue;
    const a = items[q.key as keyof MonthlyAuditItems] as
      | ScoreAnswer
      | undefined;
    if (a?.score !== undefined) scores.push(a.score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthsSinceJoin(iso: string | null): number {
  if (!iso) return 0;
  const joined = new Date(iso);
  const now = new Date();
  return (
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth())
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
