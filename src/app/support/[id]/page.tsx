import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isSupportUser } from "@/lib/auth/support-gate";
import { getTicketThread } from "@/lib/support/queries";
import { MarkRead } from "./MarkRead";
import { ReplyBox } from "./ReplyBox";

export const dynamic = "force-dynamic";

/**
 * お問い合わせ スレッド ・ /support/[id] (2026-08-27 新設)
 *
 * 1件 = 1本。対応中は入力欄あり / 解決済みは読むだけ。
 * 入力は玄関(/support)とまったく同じD型 ─ チャットとは見た目でも分ける。
 * 設計元: public/mock/support-final.html
 */
export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/support/${id}`);
  if (!(await isSupportUser())) redirect("/");

  const thread = await getTicketThread(id);
  if (!thread) notFound();

  const { ticket, subject, messages } = thread;
  const resolved = ticket.status === "resolved";

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title={subject} fallbackHref="/support" />
        <MarkRead ticketId={ticket.id} />

        <div className="flex-1 px-4 pt-4">
          {/* 状態と、送信時に選んだ内容 */}
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-3 py-2.5 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold mb-1.5 ${
                resolved
                  ? "bg-[#efece5] text-[#8a8272]"
                  : "bg-[#fff4e0] text-[#a4700f]"
              }`}
            >
              <span className="w-[5px] h-[5px] rounded-full bg-current" />
              {resolved ? "解決済み" : "担当者が確認しています"}
            </span>
            {ticket.screen && (
              <p className="text-[10.5px] text-[#6b6b6b] leading-relaxed">
                <span className="inline-block min-w-[34px] text-[#a09684]">
                  画面
                </span>
                {ticket.screen}
              </p>
            )}
          </div>

          {/* やりとり */}
          <div className="flex flex-col">
            {messages.map((m) => {
              const mine = m.sender_kind === "user";
              return (
                <div
                  key={m.id}
                  className={`max-w-[84%] mb-2.5 ${mine ? "ml-auto" : ""}`}
                >
                  <p
                    className={`text-[9.5px] font-bold text-[#a09684] mb-1 ${
                      mine ? "text-right" : ""
                    }`}
                  >
                    {mine ? "あなた" : "のりfitness 担当"}
                  </p>
                  <div
                    className={`px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap ${
                      mine
                        ? "bg-[#dcefe0] border border-[#c9e3ce] text-[#22432c] rounded-xl rounded-br-sm"
                        : "bg-white border border-[#e7dcc9] text-[#333] rounded-xl rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                    {m.photo_url && (
                      <a
                        href={m.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.photo_url}
                          alt="添付された画面の写真"
                          className="rounded-lg max-w-full border border-black/5"
                        />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {resolved ? (
          <div className="px-4 pt-4 pb-10">
            <p className="text-center text-[11.5px] text-[#8a8272] bg-[#efece5] border border-[#e2ddd2] rounded-xl py-3">
              このお問い合わせは解決済みです
            </p>
          </div>
        ) : (
          <ReplyBox ticketId={ticket.id} />
        )}
      </div>
    </main>
  );
}
