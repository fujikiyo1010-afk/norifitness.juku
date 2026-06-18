import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateMyConversation,
  listMyMessages,
} from "@/lib/chat/queries";
import { markReadAsUser } from "@/lib/chat/actions";
import { MemberHeader } from "@/components/MemberHeader";
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
        <MemberHeader title="チャット" fallbackHref="/" />
        <main className="min-h-screen bg-[#f9f5ed]">
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

  // 既読セット (Server Action ・表示と同時に admin 発の未読をクリア)
  await markReadAsUser();

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
      <MemberHeader title="のり氏チャット" fallbackHref="/" />
      <main className="flex flex-col flex-1 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px] flex-1 flex flex-col">
          {/* 説明 */}
          <div className="px-4 pt-3 pb-1">
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
      </main>
    </>
  );
}
