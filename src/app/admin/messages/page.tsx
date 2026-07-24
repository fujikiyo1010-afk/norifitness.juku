import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  listConversationsForAdmin,
  getOrCreateConversationForUserAsAdmin,
} from "@/lib/chat/queries";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 ・チャット受信箱 ・ 2026-06-18 #2 / 2026-07-24 新モデル
 *
 * - 全受講生の conversation を新着順に一覧(未対応を強調・完了/取り消し)
 * - ?user=<受講生ID> で来たら、その人の会話へ解決して個別スレッドへ転送
 *   (個別ハブ / デイリー添削 → その人のチャットへ直接飛ぶ動線)
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // 受講生指定で来たら、その人の会話へ転送(なければ作成)
  if (sp.user) {
    const conv = await getOrCreateConversationForUserAsAdmin(sp.user);
    if (conv) redirect(`/admin/messages/${conv.id}`);
  }

  const conversations = await listConversationsForAdmin();
  const unhandledCount = conversations.filter((c) => c.unhandled).length;

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-6 py-4 border-b border-zinc-200">
        <h1 className="text-lg font-bold text-zinc-900">チャット 受信箱</h1>
        <p className="text-[12px] text-zinc-500 mt-0.5">
          全 {conversations.length} 件の会話 ・{" "}
          <span className="font-bold text-[#b45309]">
            未対応 {unhandledCount} 人
          </span>
        </p>
      </header>
      <InboxClient conversations={conversations} />
    </div>
  );
}
