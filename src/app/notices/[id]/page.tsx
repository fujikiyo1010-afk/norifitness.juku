import { notFound, redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { createClient } from "@/lib/supabase/server";
import { getAnnouncementForMember } from "@/lib/member/board";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ お知らせ詳細（P2b-1・A1）
 * アナウンス系の着地先。食事コメント・月次は各ページに直行するので、ここはアナウンスのみ。
 */
export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/notices/${id}`);

  const ann = await getAnnouncementForMember(id);
  if (!ann) notFound();

  return (
    <>
      <MemberHeader title="お知らせ" fallbackHref="/notices" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          <article className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-5 py-5">
            <div className="text-[11px] font-mono text-[#a59b8c]">
              {ann.sentAtLabel}
            </div>
            <h1 className="mt-1 text-[17px] font-bold text-[#2b2620]">
              {ann.subject}
            </h1>
            <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[#3f3a32]">
              {ann.body_text}
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-[#efe6d4] pt-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4a875b] text-[12px] font-bold text-white">
                の
              </span>
              <span className="text-[12px] font-bold text-[#5b5344]">
                のりfitness
              </span>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
