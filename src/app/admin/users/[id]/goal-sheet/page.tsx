import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGoalSheetForUser,
  listGoalSheetRevisionsForUser,
} from "@/lib/goal-sheet/queries";
import {
  getLatestAuditForUser,
  listAuditsForUser,
} from "@/lib/monthly-audit/queries";
import {
  extractWeightSeries,
  extractWaistSeries,
  getLatestAndPrevious,
  calcWeightProgress,
  calcBMI,
  classifyBMI,
} from "@/lib/monthly-audit/series";
import { getAuditStatus } from "@/lib/monthly-audit/types";
import { GoalSheetAuditEditor } from "./GoalSheetAuditEditor";

export const dynamic = "force-dynamic";

/**
 * 管理画面 目標シート 添削作業 (/admin/users/[id]/goal-sheet)
 *
 * 役割:
 *   - 受講生が入力した目標シートを項目単位で添削
 *   - 添削粒度: B 案 (field_comments / section_comments / summary、memory 方針通り)
 *   - 保存先: goal_sheets.content.audits (既存型)
 *
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)
 * アクセス制御: requireAdmin
 */
export default async function AdminGoalSheetAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, name, nickname")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) notFound();

  const [sheet, latestAudit, recentAudits, revisions] = await Promise.all([
    getGoalSheetForUser(userId),
    getLatestAuditForUser(userId),
    listAuditsForUser(userId, 5),
    listGoalSheetRevisionsForUser(userId, 5),
  ]);
  const displayName = userRow.nickname || userRow.name;
  const hubHref = `/admin/users/${userId}`;

  // 参考情報の計算
  const weightSeries = extractWeightSeries(recentAudits);
  const waistSeries = extractWaistSeries(recentAudits);
  const { latest: latestWeight, previous: prevWeight } =
    getLatestAndPrevious(weightSeries);
  const { latest: latestWaist, previous: prevWaist } =
    getLatestAndPrevious(waistSeries);

  const heightCm = sheet?.content.current_status?.height_cm ?? null;
  const currentBodyFat =
    sheet?.content.current_status?.body_fat_pct ?? null;
  const currentBMI = calcBMI(latestWeight, heightCm);
  const bmiCategory = currentBMI !== null ? classifyBMI(currentBMI) : null;

  const startWeight = sheet?.content.current_status?.weight_kg ?? null;
  const targetWeight = sheet?.content.goal_selection?.target_weight_kg ?? null;
  const weightProgress = calcWeightProgress(
    startWeight,
    latestWeight,
    targetWeight
  );

  const auditStatus = getAuditStatus(latestAudit);

  if (!sheet) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <header className="mb-6 flex items-center gap-3">
            <Link
              href={hubHref}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
              aria-label="受講生ハブに戻る"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-zinc-900">
              {displayName} さんの目標シート添削
            </h1>
          </header>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-900">
              この受講生はまだ目標シートを作成していません。受講生が初回入力するまで添削できません。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 過去添削履歴 (C-2): 各 fieldKey ごとに revisions から field_comments を時系列で集める
  const fieldHistory: Record<string, Array<{ date: string; text: string; who: string }>> = {};
  for (const r of revisions) {
    const fc = r.snapshot?.audits?.field_comments ?? {};
    for (const [fieldKey, comment] of Object.entries(fc)) {
      if (!comment || typeof comment !== "object") continue;
      const c = comment as { text?: string; who?: string; date?: string };
      if (!c.text) continue;
      if (!fieldHistory[fieldKey]) fieldHistory[fieldKey] = [];
      fieldHistory[fieldKey].push({
        date: c.date ?? r.created_at.slice(0, 10),
        text: c.text,
        who: c.who ?? "のりfitness",
      });
    }
  }
  // 重複除去 (同じ date+text は 1 つに)
  for (const key of Object.keys(fieldHistory)) {
    const seen = new Set<string>();
    fieldHistory[key] = fieldHistory[key].filter((e) => {
      const id = `${e.date}|${e.text}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // 日付降順
    fieldHistory[key].sort((a, b) => b.date.localeCompare(a.date));
  }

  return (
    <GoalSheetAuditEditor
      userId={userId}
      displayName={displayName}
      sheet={sheet}
      hubHref={hubHref}
      fieldHistory={fieldHistory}
      referenceData={{
        weightSeries,
        waistSeries,
        latestWeight,
        prevWeight,
        latestWaist,
        prevWaist,
        currentBodyFat,
        currentBMI,
        bmiCategory,
        weightProgress,
        startWeight,
        targetWeight,
        auditStatus,
        latestAuditTargetMonth: latestAudit?.target_month ?? null,
        latestAuditId: latestAudit?.id ?? null,
        latestAuditAvgScore: latestAudit ? calcAvgScore(latestAudit.items) : null,
        latestAuditItems: latestAudit?.items ?? null,
        revisions: revisions.map((r) => ({
          created_at: r.created_at,
          edited_by: r.edited_by,
          auditCount: countAuditsInSnapshot(r.snapshot),
        })),
      }}
    />
  );
}

function calcAvgScore(items: Record<string, unknown>): number | null {
  const scores: number[] = [];
  for (const key of Object.keys(items)) {
    const a = items[key] as { score?: number } | undefined;
    if (typeof a?.score === "number") scores.push(a.score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function countAuditsInSnapshot(snapshot: {
  audits?: {
    field_comments?: Record<string, unknown>;
    section_comments?: Record<string, unknown>;
    summary?: unknown;
  };
}): number {
  const a = snapshot.audits;
  if (!a) return 0;
  return (
    Object.keys(a.field_comments ?? {}).length +
    Object.keys(a.section_comments ?? {}).length +
    (a.summary ? 1 : 0)
  );
}
