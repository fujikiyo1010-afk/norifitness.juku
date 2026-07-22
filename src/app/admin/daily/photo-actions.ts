"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { listBodyPhotosForUser, type AdminBodyPhoto } from "@/lib/admin/body-photos";

/**
 * デイリー添削「写真」タブ用(体型写真): タブを開いた時だけ署名URLを取りに行く(遅延読込)。
 * 初期表示には含めない=初期往復を増やさない。管理のみ。
 */
export async function getUserBodyPhotosForDaily(
  userId: string
): Promise<AdminBodyPhoto[]> {
  await requireAdmin();
  return listBodyPhotosForUser(userId);
}
