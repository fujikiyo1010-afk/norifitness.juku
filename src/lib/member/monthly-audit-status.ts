import { getMyCurrentCycle, getMyAudit } from "@/lib/monthly-audit/queries";
import { getAuditStatus, type AuditStatus } from "@/lib/monthly-audit/types";

/**
 * ホーム画面 横長カード用 月次添削 状態取得(入会日起点サイクル対応・2026-07-30)。
 *
 * cycleNumber:
 *   - 0        : 第1回前(入会30日未満)。「第1回は入会30日後」を出す。
 *   - 1..6     : その回。status に応じて 未記入/記入中/添削待ち/添削あり。
 */
export type HomeMonthlyAuditStatus = {
  status: AuditStatus;
  hasReviewNotice: boolean;
  cycleNumber: number;
};

export async function getMyMonthlyAuditHomeStatus(): Promise<HomeMonthlyAuditStatus> {
  const cycle = await getMyCurrentCycle();
  const cycleNumber = cycle?.cycleNumber ?? 0;
  const audit = cycle && cycleNumber >= 1 ? await getMyAudit(cycle.anchor) : null;
  const status = getAuditStatus(audit);
  return {
    status,
    hasReviewNotice: status === "d_replied",
    cycleNumber,
  };
}
