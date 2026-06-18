import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getMyFlashbackReview,
  type MyReviewWithContext,
} from "@/lib/courses/queries";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

function daysAgo(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000));
}

export default async function MyLogPage() {
  const supabase = await createClient();

  // 各セクションのカウント取得 (= 振り返り + 完了履歴 + 実践リスト 全体件数)
  const [
    { count: reviewCount },
    { count: completedCount },
    { count: actionsCount },
    flashback,
  ] = await Promise.all([
    supabase.from("lesson_reviews").select("*", { count: "exact", head: true }),
    supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("is_completed", true),
    supabase
      .from("real_world_actions")
      .select("*", { count: "exact", head: true }),
    getMyFlashbackReview(),
  ]);

  return (
    <>
      <MemberHeader title="学習" fallbackHref="/" />
      <main className="flex flex-1 flex-col bg-[#f3ecda] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] p-6 space-y-6">
        <p className="text-sm text-zinc-600 dark:text-[#a59b8c]">
          あなたの学びの軌跡を一覧できます。
        </p>

        {/* フラッシュバックカード(過去の振り返り再表示) */}
        {flashback && <FlashbackCard review={flashback} />}

        {/* ハブ 3 カード (Q8-A 採用: 振り返り → 実践リスト → 完了履歴 順 = リアクティブ系上、 履歴下) */}
        <section className="grid grid-cols-2 gap-3">
          <HubCard
            href="/my-log/reviews"
            icon={<PenIcon />}
            title="振り返り"
            count={reviewCount ?? 0}
            countLabel="件記入"
          />
          <HubCard
            href="/my-log/actions"
            icon={<RocketIcon />}
            title="実践リスト"
            count={actionsCount ?? 0}
            countLabel="件宣言"
          />
          <HubCard
            href="/my-log/completed"
            icon={<CheckCircleIcon />}
            title="完了履歴"
            count={completedCount ?? 0}
            countLabel="レッスン完了"
          />
        </section>
      </div>
    </main>
    </>
  );
}

function FlashbackCard({ review }: { review: MyReviewWithContext }) {
  const days = daysAgo(review.created_at);
  const dayLabel = days === 0 ? "今日" : `${days} 日前`;

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-700 dark:text-amber-300 flex-shrink-0">
          <ThoughtIcon />
        </span>
        <div className="flex-1">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {dayLabel}のあなたの振り返り
          </p>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            「{review.lesson_title}」
          </p>
        </div>
      </div>

      {review.learned && (
        <p className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-2">
          <span className="text-xs text-amber-700 dark:text-amber-300 mr-1">
            学んだ:
          </span>
          {review.learned}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Link
          href={`/courses/${review.course_id}/chapters/${review.chapter_id}/lessons/${review.lesson_id}`}
          className="text-xs text-amber-800 dark:text-amber-200 underline hover:text-amber-900 dark:hover:text-amber-100"
        >
          → このレッスンに戻る
        </Link>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          実践できてますか?
        </span>
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  count,
  countLabel,
  comingSoon = false,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  countLabel?: string;
  comingSoon?: boolean;
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 h-full ${
        comingSoon
          ? "border-zinc-200 dark:border-zinc-800 bg-[#f3ecda] dark:bg-zinc-900/50 opacity-70"
          : "border-emerald-300 dark:border-emerald-800 bg-[#fffdf8] dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-700 dark:text-zinc-300 flex-shrink-0">{icon}</span>
          <h3 className="font-semibold text-[#2b2620] dark:text-zinc-50">
            {title}
          </h3>
        </div>
        {comingSoon && (
          <span className="text-xs rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-[#a59b8c] px-2 py-0.5">
            準備中
          </span>
        )}
      </div>
      {!comingSoon && count !== undefined && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-2xl font-bold text-[#2b2620] dark:text-zinc-50">
            {count}
          </span>
          <span className="ml-1 text-xs text-[#6a6256]">{countLabel}</span>
        </p>
      )}
      {!comingSoon && href && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          → 一覧を見る
        </p>
      )}
      {comingSoon && (
        <p className="mt-2 text-xs text-[#6a6256]">
          {count !== undefined && countLabel
            ? `${count} ${countLabel} (Phase 4 以降で実装予定)`
            : "Phase 4 以降で実装予定"}
        </p>
      )}
    </div>
  );

  if (comingSoon || !href) {
    return <div>{content}</div>;
  }
  return <Link href={href}>{content}</Link>;
}

// =====================================================================
// アイコン (線画黒一色、 許可絵文字は ✓ ▶ → ← のみ)
// =====================================================================

const ICO_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ChartIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg {...ICO_PROPS} width="20" height="20">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg {...ICO_PROPS} width="20" height="20">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg {...ICO_PROPS} width="20" height="20">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ThoughtIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
