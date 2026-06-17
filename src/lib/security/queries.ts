import { createAdminClient } from "@/lib/supabase/admin";

/**
 * security_events 取得 (2026-06-18 線① #3-b)
 *
 * 受講生ハブ画面 (/admin/users/[id]) で「セキュリティ履歴」 表示に使用。
 * admin client (service_role) なので RLS は通すが、 admin 画面側で requireAdmin 済前提。
 */

export type SecurityEventType = "password_changed";

export type SecurityEventRow = {
  id: string;
  user_id: string;
  event_type: SecurityEventType;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export async function listSecurityEventsForUser(
  userId: string,
  limit = 10
): Promise<SecurityEventRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("security_events")
    .select("id, user_id, event_type, occurred_at, metadata")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SecurityEventRow[];
}

export function labelForSecurityEventType(t: SecurityEventType): string {
  switch (t) {
    case "password_changed":
      return "パスワード変更";
    default:
      return t;
  }
}
