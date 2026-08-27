import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isSupportUser } from "@/lib/auth/support-gate";
import { listMyTickets } from "@/lib/support/queries";

export const dynamic = "force-dynamic";

/**
 * お問い合わせ 一覧 ・ /support (2026-08-27 新設)
 *
 * 玄関。上に「お問い合わせフォームへ」ボタン、下に過去のやりとりが並ぶ。
 * 初回は空。設計元: public/mock/support-flow.html 画面2
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

        <div className="px-4 pt-4 pb-8">
          <Link
            href="/support/new"
            className="flex items-center gap-3 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-4 hover:bg-[#f0e6d3] transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-[#eaf3ec] text-[#2f6b41] flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px]"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 0 1 3.9-2 2.2 2.2 0 0 1 .2 3.4c-.8.7-1.6 1-1.6 2.1" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold text-[#2b2620]">
                お問い合わせフォームへ
              </span>
              <span className="block text-[11px] text-[#8a8272] mt-0.5">
                不具合・使い方のご相談
              </span>
            </span>
            <span className="text-[#a59b8c] text-lg">›</span>
          </Link>

          {tickets.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-[#6a6256] tracking-widest mt-6 mb-2">
                これまでのお問い合わせ
              </div>
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
                      {t.has_admin_reply && !resolved && (
                        <span className="inline-block bg-[#d6536a] text-white text-[9px] font-bold rounded-full px-2 py-0.5 mb-1">
                          返信あり
                        </span>
                      )}
                      <p className="text-[13px] font-bold text-[#2b2620] leading-relaxed">
                        {t.subject}
                      </p>
                      <p className="text-[10px] text-[#a59b8c] mt-1">
                        {formatDate(t.created_at)} ・{" "}
                        {resolved ? (
                          <>
                            解決済み{" "}
                            <span className="text-[#a59b8c]">（読むだけ）</span>
                          </>
                        ) : (
                          <>
                            対応中{" "}
                            <span className="text-[#4a875b]">
                              （続けて聞けます）
                            </span>
                          </>
                        )}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </>
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
