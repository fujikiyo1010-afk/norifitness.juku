import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { createClient } from "@/lib/supabase/server";
import { getMyBoardItems, type BoardItem } from "@/lib/member/board";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ お知らせ一覧（P2b-1・A1）
 * 掲示板「のりfitnessから」の「すべて見る」着地先。
 * のりの日次ひとこと（本文インライン）＋全体お知らせ（タップで詳細）を新しい順に。
 * ※既読で薄くなる制御は P2b-2（notifications）で追加。
 */
export default async function NoticesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notices");

  const items = await getMyBoardItems();

  return (
    <>
      <MemberHeader title="お知らせ" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-8 text-center">
              <div className="text-[13px] font-bold text-[#5b5344]">
                まだお知らせはありません
              </div>
              <div className="mt-1 text-[11px] text-[#a59b8c]">
                のりからの連絡やフィードバックがここに届きます。
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.key}>
                  <NoticeRow item={it} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function NoticeRow({ item }: { item: BoardItem }) {
  const inner = (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3">
      <span
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          item.kind === "daily_feedback"
            ? "bg-[#e8f3ec] text-[#34603f]"
            : "bg-[#fbf2dd] text-[#a5631f]"
        }`}
      >
        {item.kind === "daily_feedback" ? <PenIcon /> : <MegaphoneIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#8a8172]">
            {item.kind === "daily_feedback"
              ? "のりfitnessから"
              : "お知らせ"}
          </span>
          <span className="text-[10px] font-mono text-[#a59b8c]">
            {item.dateLabel}
          </span>
        </div>
        <div
          className={`mt-0.5 text-[13px] text-[#2b2620] ${
            item.kind === "announcement" ? "font-bold" : "leading-relaxed"
          }`}
        >
          {item.kind === "announcement" ? item.title : item.body}
        </div>
      </div>
      {item.href ? (
        <span className="mt-1 flex-shrink-0 text-[#a59b8c]">›</span>
      ) : null}
    </div>
  );

  return item.href ? (
    <Link href={item.href} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function PenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11l18-5v12L3 13z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
