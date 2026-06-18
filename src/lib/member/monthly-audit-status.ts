import { getMyCurrentMonthAudit } from "@/lib/monthly-audit/queries";
import { getAuditStatus, type AuditStatus } from "@/lib/monthly-audit/types";

/**
 * ホーム画面 横長カード用 月次添削 状態取得。
 *
 * 表示は 4 パターン:
 *   - a_empty:       「まだ記入されていません」 (グレー)
 *   - b_in_progress: 「記入中 ・ 提出を待っています」 (グレー)
 *   - c_submitted:   「記入済 ・ 添削待ち」 (グレー)
 *   - d_replied:     「のりfitness から添削が届いています」 (黄バッジ)
 */
export type HomeMonthlyAuditStatus = {
  status: AuditStatus;
  hasReviewNotice: boolean;
};

export async function getMyMonthlyAuditHomeStatus(): Promise<HomeMonthlyAuditStatus> {
  const audit = await getMyCurrentMonthAudit();
  const status = getAuditStatus(audit);
  return {
    status,
    hasReviewNotice: status === "d_replied",
  };
}
