"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Review = {
  id: string;
  lesson_id: string;
  lesson_title: string;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
  course_sort_order: number;
  chapter_sort_order: number;
  lesson_sort_order: number;
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

type UnreviewedLesson = {
  lesson_id: string;
  lesson_title: string;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
  completed_at: string;
};

type Mode = "latest" | "by_course" | "unwritten";

function formatJst(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function ReviewsListView({
  reviews,
  unreviewedLessons,
}: {
  reviews: Review[];
  unreviewedLessons: UnreviewedLesson[];
}) {
  const [mode, setMode] = useState<Mode>("latest");
  const [query, setQuery] = useState("");

  // クエリで振り返りを絞り込む
  const filteredReviews = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return reviews;
    return reviews.filter((r) => {
      const haystack = [
        r.lesson_title,
        r.chapter_title,
        r.course_title,
        r.learned ?? "",
        r.impressed ?? "",
        r.next_action ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reviews, query]);

  return (
    <div className="space-y-4">
      {/* 検索 */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="振り返りを検索(キーワード、レッスン名 等)"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-10 pr-3 py-2 text-sm"
        />
      </div>

      {/* モード切替タブ */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <ModeTab
          active={mode === "latest"}
          onClick={() => setMode("latest")}
          label="新しい順"
          count={reviews.length}
        />
        <ModeTab
          active={mode === "by_course"}
          onClick={() => setMode("by_course")}
          label="コース別"
          count={reviews.length}
        />
        <ModeTab
          active={mode === "unwritten"}
          onClick={() => setMode("unwritten")}
          label="未記入"
          count={unreviewedLessons.length}
          highlight={unreviewedLessons.length > 0}
        />
      </div>

      {/* 検索中の表示 */}
      {query.trim().length > 0 && (
        <p className="text-xs text-zinc-500">
          🔍 「{query}」でフィルタ中 ({filteredReviews.length} 件)
        </p>
      )}

      {/* リスト本体 */}
      {mode === "latest" && (
        <LatestList reviews={filteredReviews} query={query} />
      )}
      {mode === "by_course" && (
        <CourseGroupedList reviews={filteredReviews} query={query} />
      )}
      {mode === "unwritten" && (
        <UnwrittenList lessons={unreviewedLessons} />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  count,
  highlight = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50"
          : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
          highlight
            ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function LatestList({ reviews, query }: { reviews: Review[]; query: string }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-zinc-500 p-4 text-center">
        {query.trim().length > 0
          ? "該当する振り返りが見つかりませんでした。"
          : "まだ振り返りがありません。レッスン視聴後に書いてみましょう。"}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} query={query} />
      ))}
    </ul>
  );
}

function CourseGroupedList({
  reviews,
  query,
}: {
  reviews: Review[];
  query: string;
}) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-zinc-500 p-4 text-center">
        {query.trim().length > 0
          ? "該当する振り返りが見つかりませんでした。"
          : "まだ振り返りがありません。"}
      </p>
    );
  }

  // コース → 章 → レッスン でグループ化
  type ChapterGroup = {
    chapter_id: string;
    chapter_title: string;
    chapter_sort_order: number;
    reviews: Review[];
  };
  type CourseGroup = {
    course_id: string;
    course_title: string;
    course_sort_order: number;
    chapters: Map<string, ChapterGroup>;
  };

  const courseMap = new Map<string, CourseGroup>();
  for (const r of reviews) {
    let course = courseMap.get(r.course_id);
    if (!course) {
      course = {
        course_id: r.course_id,
        course_title: r.course_title,
        course_sort_order: r.course_sort_order,
        chapters: new Map(),
      };
      courseMap.set(r.course_id, course);
    }
    let chapter = course.chapters.get(r.chapter_id);
    if (!chapter) {
      chapter = {
        chapter_id: r.chapter_id,
        chapter_title: r.chapter_title,
        chapter_sort_order: r.chapter_sort_order,
        reviews: [],
      };
      course.chapters.set(r.chapter_id, chapter);
    }
    chapter.reviews.push(r);
  }

  const sortedCourses = Array.from(courseMap.values()).sort(
    (a, b) => a.course_sort_order - b.course_sort_order
  );

  return (
    <div className="space-y-5">
      {sortedCourses.map((course) => {
        const sortedChapters = Array.from(course.chapters.values()).sort(
          (a, b) => a.chapter_sort_order - b.chapter_sort_order
        );
        return (
          <div key={course.course_id} className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              📖 {course.course_title}
            </h3>
            {sortedChapters.map((chapter) => {
              const sortedReviews = [...chapter.reviews].sort(
                (a, b) => a.lesson_sort_order - b.lesson_sort_order
              );
              return (
                <div key={chapter.chapter_id} className="ml-4 space-y-2">
                  <h4 className="text-xs text-zinc-600 dark:text-zinc-400">
                    📑 {chapter.chapter_title}
                  </h4>
                  <ul className="space-y-2">
                    {sortedReviews.map((r) => (
                      <ReviewCard key={r.id} review={r} query={query} compact />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function UnwrittenList({ lessons }: { lessons: UnreviewedLesson[] }) {
  if (lessons.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4 text-center space-y-1">
        <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium">
          🎉 素晴らしい!
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          完了したレッスンすべてに振り返りを書いています。
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        💡 完了マークしたけど振り返り未記入のレッスン。書き残しておくと後で活きます。
      </p>
      <ul className="space-y-2">
        {lessons.map((l) => (
          <li
            key={l.lesson_id}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <Link
              href={`/courses/${l.course_id}/chapters/${l.chapter_id}/lessons/${l.lesson_id}`}
              className="group block"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50 group-hover:underline">
                {l.lesson_title}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                📖 {l.course_title} / 📑 {l.chapter_title}
                {l.completed_at && ` · 完了 ${formatJst(l.completed_at)}`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                → 振り返りを書く
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({
  review,
  query,
  compact = false,
}: {
  review: Review;
  query: string;
  compact?: boolean;
}) {
  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/courses/${review.course_id}/chapters/${review.chapter_id}/lessons/${review.lesson_id}`}
          className="group flex-1 min-w-0"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50 group-hover:underline">
            <Highlight text={review.lesson_title} query={query} />
          </p>
          {!compact && (
            <p className="text-xs text-zinc-500 mt-0.5">
              📖 <Highlight text={review.course_title} query={query} /> / 📑{" "}
              <Highlight text={review.chapter_title} query={query} />
            </p>
          )}
        </Link>
        <span className="shrink-0 text-xs text-zinc-500">
          {formatJst(review.updated_at)}
        </span>
      </div>

      {review.learned && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-xs text-zinc-500 mr-1">学んだ:</span>
          <Highlight text={review.learned} query={query} />
        </div>
      )}
      {review.impressed && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-xs text-zinc-500 mr-1">印象:</span>
          <Highlight text={review.impressed} query={query} />
        </div>
      )}
      {review.next_action && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="text-xs text-zinc-500 mr-1">次やる:</span>
          <Highlight text={review.next_action} query={query} />
        </div>
      )}
    </li>
  );
}
