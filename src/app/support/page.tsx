import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isSupportUser } from "@/lib/auth/support-gate";
import { listMyTickets } from "@/lib/support/queries";
import { SupportComposer } from "./SupportComposer";

export const dynamic = "force-dynamic";

/**
 * お問い合わせ 玄関 兼 送信 ・ /support (2026-08-27 新設)
 *
 * 上が「新しく送る」、下が「これまでのお問い合わせ」。
 * 送信フォーム専用の画面は作らない = 初回に「ボタンだけの空っぽの画面」を見せない。
 * 設計元: public/mock/support-final.html
 */
export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/support");
  if (!(await isSupportUser())) redirect("/");

  const tickets = await listMyTickets();

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="お問い合わせ" fallbackHref="/account" />

        <div className="px-4 pt-4 pb-10">
          <p className="text-[12px] leading-relaxed text-[#5b5b5b] mb-3.5">
            アプリの不具合や、使い方で分からないことをお送りください。
            <br />
            担当者が確認して、このページでお返事します。
          </p>

          <SupportComposer />

          <div className="border-t border-[#e7dcc9] mt-6 mb-3" />

          <div className="text-[10px] font-bold text-[#6a6256] tracking-widest mb-2">
            これまでのお問い合わせ
          </div>

          {tickets.length === 0 ? (
            <p className="text-center text-[11px] text-[#a59b8c] py-2.5">
              まだありません
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((t) => {
                const resolved = t.status === "resolved";
                return (
                  <Link
                    key={t.id}
                    href={`/support/${t.id}`}
                    className={`block bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3 hover:bg-[#f0e6d3] transition-colors ${
                      resolved ? "opacity-70" : ""
                    }`}
                  >
                    {t.unread && (
                      <span className="inline-block bg-[#d6536a] text-white text-[9px] font-bold rounded-full px-2 py-0.5 mb-1">
                        お返事あり
                      </span>
                    )}
                    <p className="text-[13px] font-bold text-[#2b2620] leading-relaxed">
                      {t.subject}
                    </p>
                    <p className="text-[10px] text-[#a59b8c] mt-1">
                      {formatDate(t.created_at)} ・{" "}
                      {resolved ? "解決済み" : "対応中"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-[#8a8272] leading-relaxed mt-6">
            食事やトレーニングのご相談は、これまでどおりチャットへお送りください。
          </p>
        </div>
      </div>
    </main>
  );
}

/** サーバ側は UTC で動くので、表示は必ず JST に寄せる */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}
