import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getMyFeedbackTimeline } from "@/lib/history/feedbacks";
import { FeedbacksClient } from "./FeedbacksClient";

export const dynamic = "force-dynamic";

/** 受講生「デイリー添削」ページ(M17・P7・ベータ)。時系列＋月チップ＋しおり保存＋保存済みタブ。 */
export default async function FeedbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const sp = await searchParams;
  const timeline = await getMyFeedbackTimeline();

  return (
    <>
      <MemberHeader title="デイリー添削" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <FeedbacksClient timeline={timeline} initialTab={sp.tab === "saved" ? "saved" : "all"} />
        </div>
      </main>
    </>
  );
}
