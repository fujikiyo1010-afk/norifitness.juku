import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { listSupportTicketsForAdmin } from "@/lib/support/admin-queries";
import { currentAppVersion } from "@/lib/support/app-version";
import { SupportShell } from "./SupportShell";

export const dynamic = "force-dynamic";

/**
 * 管理画面 お問い合わせ ・ 共通レイアウト (2026-08-27 新設)
 *
 * 左に一覧・右に詳細の1画面。/admin/support/{id} で開いてもその件が選択された状態で
 * 着地する(通知のリンク先がこのURLで固定されているため・指示書§7)。
 * 一覧は layout で1回だけ取り、詳細ページの行き来では取り直さない。
 */
export default async function AdminSupportLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const tickets = await listSupportTicketsForAdmin();

  return (
    <SupportShell tickets={tickets} currentVersion={currentAppVersion()}>
      {children}
    </SupportShell>
  );
}
