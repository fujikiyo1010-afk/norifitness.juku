import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getMyFlashbackReview,
  listMyUnreviewedCompletedLessons,
  type MyReviewWithContext,
} from "@/lib/courses/queries";

export const dynamic = "force-dynamic";

function daysAgo(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000));
}

export default async function MyLogPage() {
  const supabase = await createClient();

  // 各セクションのカウント取得
  const [{ count: reviewCount }, { count: completedCount }, flashback, unreviewed] =
    await Promise.all([
      supabase.from("lesson_reviews").select("*", { count: "exact", head: true }),
      supabase
        .from("lesson_progress")
        .select("*", { count: "exact", head: true })
        .eq("is_completed", true),
      getMyFlashbackReview(),
      listMyUnreviewedCompletedLessons(),
    ]);

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span> / マイ学習ログ</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            📊 マイ学習ログ
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            あなたの学びの軌跡を一覧できます。
          </p>
        </header>

        {/* フラッシュバックカード(過去の振り返り再表示) */}
        {flashback && <FlashbackCard review={flashback} />}

        {/* ハブカード */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <HubCard
            href="/my-log/reviews"
            icon="📝"
            title="振り返り"
            count={reviewCount ?? 0}
            countLabel="件記入"
            badge={
              unreviewed.length > 0
                ? `${unreviewed.length} 件 未記入`
                : null
            }
          />
          <HubCard
            icon="🔖"
            title="ブックマーク"
            comingSoon
          />
          <HubCard
            icon="💪"
            title="実践リスト"
            comingSoon
          />
          <HubCard
            icon="✅"
            title="完了履歴"
            count={completedCount ?? 0}
            countLabel="レッスン完了"
            comingSoon
          />
        </section>
      </div>
    </main>
  );
}

function FlashbackCard({ review }: { review: MyReviewWithContext }) {
  const days = daysAgo(review.created_at);
  const dayLabel = days === 0 ? "今日" : `${days} 日前`;

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">💭</span>
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
      {review.next_action && (
        <p className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-2">
          <span className="text-xs text-amber-700 dark:text-amber-300 mr-1">
            次やる:
          </span>
          {review.next_action}
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
  badge,
  comingSoon = false,
}: {
  href?: string;
  icon: string;
  title: string;
  count?: number;
  countLabel?: string;
  badge?: string | null;
  comingSoon?: boolean;
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 h-full ${
        comingSoon
          ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 opacity-70"
          : "border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h3>
        </div>
        {comingSoon && (
          <span className="text-xs rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5">
            準備中
          </span>
        )}
      </div>
      {!comingSoon && count !== undefined && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {count}
          </span>
          <span className="ml-1 text-xs text-zinc-500">{countLabel}</span>
        </p>
      )}
      {badge && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ {badge}
        </p>
      )}
      {!comingSoon && href && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          → 一覧を見る
        </p>
      )}
      {comingSoon && (
        <p className="mt-2 text-xs text-zinc-500">
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
