import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateMyConversation,
  listMyMessages,
} from "@/lib/chat/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import { MessagesClient } from "./MessagesClient";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・チャット (/messages) ・ 2026-06-18 線① #2 新設
 *
 * - 自分の conversation 取得 (なければ作成)
 * - messages を時系列で取得
 * - 表示と同時に既読セット (= markReadAsUser)
 * - Client 側で Realtime 購読 + 送信フォーム
 */
export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const conversation = await getOrCreateMyConversation();
  if (!conversation) {
    return (
      <>
        <RefreshOnFocus />
        <MemberHeader title="チャット" fallbackHref="/" />
        <main className="min-h-[100dvh] bg-[#f9f5ed]">
          <div className="mx-auto max-w-[460px] px-4 py-5 text-center">
            <p className="text-sm text-[#6a6256]">
              会話の取得に失敗しました。 もう一度開き直してください。
            </p>
          </div>
        </main>
      </>
    );
  }

  const messages = await listMyMessages(conversation.id, 200);

  // 既読セット (直接 update ・「use server」 action 経由だと revalidatePath が render 中に走るので直接更新)
  await supabase
    .from("conversations")
    .update({ last_read_at_user: new Date().toISOString() })
    .eq("user_id", user.id);

  // 受講生氏名 (= 自分の表示色用、 大きく display しない予定)
  const { data: userRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const myName =
    (userRow as { name?: string | null } | null)?.name ?? "あなた";

  return (
    <>
      <RefreshOnFocus />
      {/* 2026-07-13: 下部ナビ表示に伴い、高さを「画面 - ナビ高さ」に。入力欄がナビの真上に収まる。 */}
      <div
        className="flex flex-col bg-[#e8efe1]"
        style={{ height: "calc(100dvh - 60px - env(safe-area-inset-bottom))" }}
      >
      <MemberHeader title="チャット" fallbackHref="/" />
      <div className="mx-auto w-full max-w-[460px] flex-1 flex flex-col min-h-0">
        {/* 説明 (= flex-shrink-0) */}
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <p className="text-[11px] text-[#6a6256] leading-relaxed">
            のり氏に質問・相談ができます。 返信には数日かかる場合があります。
            <br />
            <Link href="/account/help" className="text-[#34603f] underline">
              よくある質問はこちら
            </Link>
          </p>
        </div>

        <MessagesClient
          conversationId={conversation.id}
          initialMessages={messages}
          myUserId={user.id}
          myName={myName}
        />
      </div>
      </div>
    </>
  );
}
