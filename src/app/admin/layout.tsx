import type { ReactNode } from "react";
import { UploadJobProvider } from "@/lib/upload/UploadJobContext";
import { UploadIndicator } from "@/components/UploadIndicator";
import { requireAdmin } from "@/lib/auth/admin";
import { countAdminDashboardMetrics } from "@/lib/workout/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTotalUnreadCount } from "@/lib/chat/queries";
import { AdminSideNav } from "./_components/AdminSideNav";

/**
 * 管理画面共通レイアウト。
 * - サイドナビ (7 セクション ・ バッジ動的) を全ページ共通で表示
 * - UploadJobProvider: 月次添削動画のバックグラウンドアップロード状態管理
 * - UploadIndicator: 右下フローティング表示 (送信中/完了/失敗)
 *
 * /admin/* 以下のページにだけ適用される。
 * 受講生側のページ (/monthly-review/* など) には影響しない。
 *
 * 認証: requireAdmin を layout で実行するため、各ページの requireAdmin は冗長
 * (ただし型推論のため各ページに残しても害なし)。
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // metrics + 未発送件数 + チャット未読 を並列取得
  const [metrics, pendingShipmentsRes, chatUnread] = await Promise.all([
    countAdminDashboardMetrics(),
    supabase
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    getAdminTotalUnreadCount(),
  ]);

  return (
    <UploadJobProvider>
      {/* 件G(2026-07-13): アプリシェル型。外側を h-screen+overflow-hidden にし、本文(main)だけを
          縦スクロールさせる。これでサイドナビは全ページで画面固定。従来は main の overflow-x-auto が
          overflow-y も auto 化し main がスクロール文脈になって、デイリー添削の sticky(FBバー/キュー列)が
          viewport でなく main 基準になり流れていた(2026-06-11 a88ea3b からの潜在バグ)。 */}
      <div className="flex h-screen overflow-hidden bg-zinc-50">
        <AdminSideNav
          adminName={admin.name}
          totalUsers={metrics.totalUsers}
          pendingAudits={metrics.pendingAudits}
          pendingRequests={metrics.pendingTotal}
          pendingShipments={pendingShipmentsRes.count ?? 0}
          chatUnread={chatUnread}
        />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <UploadIndicator />
    </UploadJobProvider>
  );
}
