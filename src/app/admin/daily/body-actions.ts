"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { listBodyMetricsForAdmin, type BodyMetricRow } from "@/lib/body-metrics/queries";

/**
 * まとめパネル・体組成タブ用(2026-07-13): タブを開いた時だけ体組成履歴を取得する(遅延読込)。
 * デイリー添削の初期表示には含めない=初期往復を増やさない。管理のみ(段1)。
 */
export async function getUserBodyMetricsForDaily(
  userId: string
): Promise<BodyMetricRow[]> {
  await requireAdmin();
  return listBodyMetricsForAdmin(userId, 365);
}
