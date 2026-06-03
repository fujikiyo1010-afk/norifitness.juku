import { requireAdmin } from "@/lib/auth/admin";
import { listAllUsersWithStatus } from "@/lib/workout/queries";
import { UsersListClient } from "./UsersListClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 受講生一覧 (/admin/users)
 *
 * 役割:
 *   - 全受講生の状態を一覧表示
 *   - 検索 / ソート / フィルタ (Client Component)
 *   - 各受講生のハブ画面に遷移
 *
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)
 * アクセス制御: requireAdmin
 */
export default async function AdminUsersListPage() {
  await requireAdmin();
  const users = await listAllUsersWithStatus();

  return <UsersListClient users={users} />;
}
