import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getConversationForAdmin } from "@/lib/chat/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminChatClient } from "./AdminChatClient";

export const dynamic = "force-dynamic";

/**
 * 管理画面 ・個別チャット (= エルメ風) ・ 2026-06-18 #2
 *
 * - 左 = チャット (吹き出し + ポーリング + 送信)
 * - 右 = 受講生情報サイドパネル (名前 / 入会日 / アバター / 受講生ハブへのリンク)
 */
export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  await requireAdmin();
  const { conversationId } = await params;

  const data = await getConversationForAdmin(conversationId);
  if (!data) notFound();

  // 既読セット (直接 update ・revalidate なし)
  const admin = createAdminClient();
  await admin
    .from("conversations")
    .update({ last_read_at_admin: new Date().toISOString() })
    .eq("id", conversationId);

  // サイドパネル用 ・受講生プロフィール詳細
  const { data: profile } = await admin
    .from("user_profiles")
    .select("birthday")
    .eq("user_id", data.user_id)
    .maybeSingle();

  const { data: userRow } = await admin
    .from("users")
    .select("joined_at, nickname")
    .eq("id", data.user_id)
    .maybeSingle();

  const joinedAt = (userRow as { joined_at?: string | null } | null)?.joined_at ?? null;
  const nickname = (userRow as { nickname?: string | null } | null)?.nickname ?? null;
  const birthday = (profile as { birthday?: string | null } | null)?.birthday ?? null;

  return (
    <div className="flex h-screen bg-white">
      {/* メイン ・チャット */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-6 py-3 border-b border-zinc-200 flex items-center gap-3">
          <Link
            href="/admin/messages"
            aria-label="受信箱に戻る"
            className="text-zinc-500 hover:text-zinc-900"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-9 h-9 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-sm">
            {(data.user_name || "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-zinc-900 truncate">
              {data.user_name}
            </div>
            <div className="text-[10.5px] text-zinc-500 font-mono truncate">
              {data.user_email}
            </div>
          </div>
        </header>

        <AdminChatClient
          conversationId={conversationId}
          initialMessages={data.messages}
        />
      </div>

      {/* 右 ・受講生情報サイドパネル */}
      <aside className="w-[280px] flex-shrink-0 border-l border-zinc-200 bg-zinc-50 p-5 overflow-y-auto hidden lg:block">
        <div className="text-[10px] font-bold text-zinc-500 tracking-wider mb-3">
          受講生情報
        </div>

        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 rounded-full bg-[#00897b] text-white flex items-center justify-center text-2xl font-bold mb-2">
            {(data.user_name || "?").charAt(0)}
          </div>
          <div className="text-sm font-bold text-zinc-900 text-center">
            {data.user_name}
          </div>
          {nickname && nickname !== data.user_name && (
            <div className="text-[11px] text-zinc-500">({nickname})</div>
          )}
        </div>

        <dl className="space-y-2.5 text-[12px] mb-5">
          <div>
            <dt className="text-zinc-500 text-[10.5px] mb-0.5">メール</dt>
            <dd className="text-zinc-900 font-mono break-all">
              {data.user_email}
            </dd>
          </div>
          {joinedAt && (
            <div>
              <dt className="text-zinc-500 text-[10.5px] mb-0.5">入会日</dt>
              <dd className="text-zinc-900 font-mono">
                {new Date(joinedAt).toLocaleDateString("ja-JP")}
              </dd>
            </div>
          )}
          {birthday && (
            <div>
              <dt className="text-zinc-500 text-[10.5px] mb-0.5">生年月日</dt>
              <dd className="text-zinc-900 font-mono">
                {new Date(birthday).toLocaleDateString("ja-JP")}
              </dd>
            </div>
          )}
        </dl>

        <Link
          href={`/admin/users/${data.user_id}`}
          className="block w-full text-center rounded-md bg-[#00897b] hover:bg-[#00695c] text-white text-[12px] font-bold py-2 transition-colors"
        >
          受講生ハブで詳細を見る →
        </Link>
      </aside>
    </div>
  );
}
