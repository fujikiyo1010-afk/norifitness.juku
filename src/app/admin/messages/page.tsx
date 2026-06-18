import { requireAdmin } from "@/lib/auth/admin";
import { listConversationsForAdmin } from "@/lib/chat/queries";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 ・チャット受信箱 (= エルメ風) ・ 2026-06-18 #2
 *
 * - 全受講生の conversation を新着順に一覧
 * - 各行: アバター + 名前 + 最終メッセージ抜粋 + 未読バッジ + 最終時刻
 * - 検索 + 未読フィルタ + クリックで個別チャット (/admin/messages/[id])
 */
export default async function AdminMessagesPage() {
  await requireAdmin();
  const conversations = await listConversationsForAdmin();

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-6 py-4 border-b border-zinc-200">
        <h1 className="text-lg font-bold text-zinc-900">チャット 受信箱</h1>
        <p className="text-[12px] text-zinc-500 mt-0.5">
          全 {conversations.length} 件の会話 ・
          未読 {conversations.filter((c) => c.unread_count > 0).length} 件
        </p>
      </header>
      <InboxClient conversations={conversations} />
    </div>
  );
}
