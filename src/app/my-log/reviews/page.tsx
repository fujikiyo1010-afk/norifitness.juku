import Link from "next/link";
import {
  listMyReviewsWithContext,
  getReviewsStats,
} from "@/lib/courses/queries";
import { ReviewsListView } from "./ReviewsListView";
import { MemberHeader } from "@/components/MemberHeader";
import { isBetaUser } from "@/lib/auth/beta";

export const dynamic = "force-dynamic";

/**
 * 振り返り 一覧 (/my-log/reviews) ・ Phase 3 リデザイン (2026-06-18)
 *
 * - 上部: 達成バンド (これまで X / 今週 Y / 連続 Z 日 + 次の節目までプログレスバー)
 * - 中央: 検索 + タブ (新しい順 / コース別) + タイムライン/グループ
 * - 末尾: 「← 学習に戻る」 リンク
 */
export default async function MyReviewsPage() {
  const [reviews, stats, isBeta] = await Promise.all([
    listMyReviewsWithContext(),
    getReviewsStats(),
    isBetaUser(),
  ]);

  return (
    <>
      <MemberHeader title="振り返り" fallbackHref="/my-log" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col p-6 space-y-5">
          <p className="text-[12px] text-[#6a6256]">
            あなたが書いた振り返りの一覧です。並び替え・検索もできます。
          </p>

          {/* 達成バンド (Phase 3 ・モック準拠) */}
          <section>
            <div className="grid grid-cols-3 gap-2.5">
              <StatBox value={stats.total} label="これまでの振り返り" />
              <StatBox
                value={stats.thisWeek}
                label="今週書いた"
                accent="coral"
              />
              <StatBox value={stats.streakDays} label="連続日数" />
            </div>
            <div className="mt-3.5 bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-3.5 py-3">
              <div className="flex justify-between text-[11px] text-[#6a6256] mb-2">
                <span>次の節目まで</span>
                <span>
                  あと{" "}
                  <b className="text-[#2b2620] font-mono">
                    {Math.max(0, stats.nextMilestone - stats.total)}件
                  </b>{" "}
                  で {stats.nextMilestone}件達成
                </span>
              </div>
              <div className="h-2 bg-[#ece3d3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4a875b] to-[#34603f] rounded-full transition-all"
                  style={{ width: `${stats.milestoneProgress}%` }}
                />
              </div>
            </div>
          </section>

          <ReviewsListView reviews={reviews} isBeta={isBeta} />

          {/* 末尾 ・ 学習に戻る (Phase 3) */}
          <div className="mt-4 flex justify-center">
            <Link
              href="/my-log"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#6a6256] hover:text-[#34603f] transition-colors"
            >
              ← 学習に戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function StatBox({
  value,
  label,
  suffix,
  accent,
}: {
  value: number;
  label: string;
  suffix?: string;
  accent?: "coral";
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-2 py-3 text-center shadow-sm">
      <div
        className={`font-mono font-bold text-[26px] leading-none ${
          accent === "coral" ? "text-[#d9743f]" : "text-[#34603f]"
        }`}
      >
        {value}
        {suffix && <span className="text-[15px] ml-0.5">{suffix}</span>}
      </div>
      <div className="text-[10.5px] text-[#6a6256] mt-1.5">{label}</div>
    </div>
  );
}
