"use client";

/**
 * 受講生ハブ画面の月次添削セクション (Client Component)
 *
 * メモ #7 対応: 動画送信中は「要対応」→「反映中」表示にする。
 * - UploadJobContext を参照し、今この audit がアップロード中か検知
 * - uploading 中: バッジ「反映中」+ 枠線アンバー、c_submitted の強調 (rose) を上書き
 * - success に遷移したら router.refresh() で再取得 → DB の d_replied (返信済み) が反映される
 *
 * 制約: UploadJobContext は同一タブ内のみ有効。別タブやリロード後は通常表示。
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUploadJob } from "@/lib/upload/UploadJobContext";
import {
  AUDIT_STATUS_LABELS_ADMIN,
  formatTargetMonthLabel,
  type AuditStatus,
  type MonthlyAuditRow,
} from "@/lib/monthly-audit/types";
import { formatDistributionDateTime } from "@/lib/workout/menu-display";

export function MonthlyAuditSection({
  latestAudit,
  auditStatus,
  userId,
}: {
  latestAudit: MonthlyAuditRow | null;
  auditStatus: AuditStatus;
  userId: string;
}) {
  const { job } = useUploadJob();
  const router = useRouter();

  const auditId = latestAudit?.id ?? null;

  // 今この audit がアップロード中か (success も含めて「反映中」扱い)
  // - uploading: 送信中
  // - success: 送信完了直後、router.refresh() でサーバーデータが更新されるまでの一瞬。
  //   この間に auditStatus は c_submitted のまま残るので、ここで「反映中」を維持しないと
  //   「要対応」赤が一瞬フラッシュする。
  // - router.refresh() が走ると auditStatus が d_replied に切り替わり、c_submitted 条件で false に。
  const isUploadingThis =
    auditStatus === "c_submitted" &&
    auditId !== null &&
    (job.status === "uploading" || job.status === "success") &&
    job.auditId === auditId;

  // success に遷移 → サーバーデータ再取得 (DB の published_at が埋まったはず)
  useEffect(() => {
    if (job.status === "success" && job.auditId === auditId && auditId !== null) {
      router.refresh();
    }
  }, [job.status, job.auditId, auditId, router]);

  // 枠線色 (反映中 > c_submitted 強調 > デフォルト の優先順)
  const borderClass = isUploadingThis
    ? "border-amber-300"
    : auditStatus === "c_submitted"
      ? "border-rose-300"
      : "border-[#e8ebe9]";

  return (
    <section className={`rounded-[14px] border bg-white p-5 ${borderClass}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-[#00897b]" />
        <h2 className="text-sm font-semibold text-zinc-900">月次添削</h2>
        <StatusBadge isUploading={isUploadingThis} baseStatus={auditStatus} />
      </div>

      {latestAudit ? (
        <>
          <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
            <dt className="text-zinc-500">最新月</dt>
            <dd className="text-zinc-900 font-medium">
              {formatTargetMonthLabel(latestAudit.target_month)}
            </dd>
            <dt className="text-zinc-500">進捗</dt>
            <dd className="text-zinc-900 font-medium">
              17 項目中 {latestAudit.items_filled_count} 項目記入済
            </dd>
            {latestAudit.submitted_at && (
              <>
                <dt className="text-zinc-500">提出日時</dt>
                <dd className="text-zinc-900 font-medium font-mono">
                  {formatDistributionDateTime(latestAudit.submitted_at)}
                </dd>
              </>
            )}
            {latestAudit.nori_video_published_at && (
              <>
                <dt className="text-zinc-500">返信日時</dt>
                <dd className="text-zinc-900 font-medium font-mono">
                  {formatDistributionDateTime(
                    latestAudit.nori_video_published_at
                  )}
                </dd>
              </>
            )}
          </dl>
          <Link
            href={`/admin/monthly-reviews/${latestAudit.id}?from=hub&user_id=${userId}`}
            className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            添削画面を開く →
          </Link>
        </>
      ) : (
        <p className="text-sm text-zinc-700">
          この受講生はまだ月次添削を 1 回も提出していません。
        </p>
      )}
    </section>
  );
}

function StatusBadge({
  isUploading,
  baseStatus,
}: {
  isUploading: boolean;
  baseStatus: AuditStatus;
}) {
  if (isUploading) {
    return (
      <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
        反映中
      </span>
    );
  }
  return (
    <span
      className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] ${auditStatusStyle(baseStatus)}`}
    >
      {AUDIT_STATUS_LABELS_ADMIN[baseStatus]}
    </span>
  );
}

function auditStatusStyle(status: AuditStatus): string {
  switch (status) {
    case "a_empty":
      return "bg-zinc-100 text-zinc-600 font-medium";
    case "b_in_progress":
      return "bg-amber-50 text-amber-800 font-medium";
    // ★ C 状態は「のり氏が一目で見つけられるよう」強調 (赤背景 + 白文字 + 太字)
    case "c_submitted":
      return "bg-rose-500 text-white font-bold shadow-sm";
    case "d_replied":
      return "bg-emerald-50 text-emerald-800 font-medium";
  }
}
