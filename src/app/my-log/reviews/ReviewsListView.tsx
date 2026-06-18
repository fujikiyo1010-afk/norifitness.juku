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

type Mode = "latest" | "by_course";

/**
 * 振り返り 一覧 Client (2026-06-18 Phase 3 ・モック準拠リデザイン)
 *
 * モード:
 *   - latest: 日付ヘッダ + カード (タイムライン形式)
 *   - by_course: コース → 章 でグループ化
 *
 * カード: タグ pill (= コース・章) + タイトル + 学んだこと + 印象・気づき + アクション 2 ボタン (緑 pill ▶ / オフホワイト ✏)
 */

function formatJstFull(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y} / ${m} / ${day}`;
}

function formatJstShort(iso: string): string {
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
            className="bg-yellow-200 text-inherit rounded px-0.5"
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

export function ReviewsListView({ reviews }: { reviews: Review[] }) {
  const [mode, setMode] = useState<Mode>("latest");
  const [query, setQuery] = useState("");

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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a59b8c] pointer-events-none flex items-center">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="振り返りを検索 (キーワード、 レッスン名 等)"
          className="w-full rounded-md border border-[#e7dcc9] bg-[#fffdf8] pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-[#4a875b]"
        />
      </div>

      {/* モード切替タブ */}
      <div className="flex gap-4">
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
      </div>

      {/* 検索中の表示 */}
      {query.trim().length > 0 && (
        <p className="text-xs text-[#6a6256] inline-flex items-center gap-1.5">
          <SearchIcon /> 「{query}」 でフィルタ中 ({filteredReviews.length} 件)
        </p>
      )}

      {mode === "latest" && (
        <LatestTimeline reviews={filteredReviews} query={query} />
      )}
      {mode === "by_course" && (
        <CourseGroupedList reviews={filteredReviews} query={query} />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-2.5 text-[14px] font-bold transition-colors border-b-2 ${
        active
          ? "text-[#2b2620] border-[#4a875b]"
          : "text-[#a59b8c] border-transparent hover:text-[#6a6256]"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 text-[13px] font-mono font-bold ${
          active ? "text-[#34603f]" : "text-[#a59b8c]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * 新しい順 タイムライン
 * - 日付ヘッダ (= 2026/06/18) + カード で 1 ブロック
 * - 同日複数あれば 1 つの日付ヘッダの下にカード並ぶ
 */
function LatestTimeline({
  reviews,
  query,
}: {
  reviews: Review[];
  query: string;
}) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-[#6a6256] p-4 text-center">
        {query.trim().length > 0
          ? "該当する振り返りが見つかりませんでした。"
          : "まだ振り返りがありません。 レッスン視聴後に書いてみましょう。"}
      </p>
    );
  }

  // 同じ日 (= JST 日付) を 1 グループに
  const groups: { dateKey: string; dateLabel: string; reviews: Review[] }[] =
    [];
  for (const r of reviews) {
    const label = formatJstShort(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === label) {
      last.reviews.push(r);
    } else {
      groups.push({
        dateKey: label,
        dateLabel: formatJstFull(r.created_at),
        reviews: [r],
      });
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.dateKey} className="space-y-2.5">
          <div className="text-[11px] text-[#a59b8c] tracking-wider font-mono">
            {g.dateLabel}
          </div>
          {g.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} query={query} />
          ))}
        </div>
      ))}
    </div>
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
      <p className="text-sm text-[#6a6256] p-4 text-center">
        {query.trim().length > 0
          ? "該当する振り返りが見つかりませんでした。"
          : "まだ振り返りがありません。"}
      </p>
    );
  }

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
            <h3 className="text-[14px] font-bold text-[#2b2620] inline-flex items-center gap-1.5">
              <BookIcon /> {course.course_title}
            </h3>
            {sortedChapters.map((chapter) => {
              const sortedReviews = [...chapter.reviews].sort(
                (a, b) => a.lesson_sort_order - b.lesson_sort_order
              );
              return (
                <div key={chapter.chapter_id} className="ml-4 space-y-2">
                  <h4 className="text-[12px] text-[#6a6256] inline-flex items-center gap-1.5">
                    <ChapterMarkIcon /> {chapter.chapter_title}
                  </h4>
                  <div className="space-y-2.5">
                    {sortedReviews.map((r) => (
                      <ReviewCard key={r.id} review={r} query={query} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 振り返りカード (= モック準拠の単一形式)
 */
function ReviewCard({ review, query }: { review: Review; query: string }) {
  return (
    <div
      className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[16px] p-4"
      style={{ boxShadow: "0 8px 20px rgba(60,45,25,.05)" }}
    >
      {/* タグ pill (= コース) */}
      <div className="mb-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#34603f] bg-[#e9f1e9] rounded-full px-2.5 py-0.5 max-w-full overflow-hidden whitespace-nowrap text-ellipsis">
          <BookIcon />
          <span className="truncate">
            <Highlight text={review.course_title} query={query} />
            {" ・ "}
            <Highlight text={review.chapter_title} query={query} />
          </span>
        </span>
      </div>

      {/* タイトル */}
      <div className="text-[16px] font-bold text-[#2b2620] leading-[1.4] mb-3">
        <Highlight text={review.lesson_title} query={query} />
      </div>

      {/* 学んだこと */}
      {review.learned && (
        <div className="mb-2.5">
          <div className="text-[11px] font-bold text-[#d9743f] tracking-wider mb-0.5">
            学んだこと
          </div>
          <div className="text-[14.5px] text-[#2b2620] leading-[1.75] whitespace-pre-wrap">
            <Highlight text={review.learned} query={query} />
          </div>
        </div>
      )}

      {/* 印象・気づき */}
      {review.impressed && (
        <div className="mb-2.5">
          <div className="text-[11px] font-bold text-[#d9743f] tracking-wider mb-0.5">
            印象・気づき
          </div>
          <div className="text-[14.5px] text-[#2b2620] leading-[1.75] whitespace-pre-wrap">
            <Highlight text={review.impressed} query={query} />
          </div>
        </div>
      )}

      {/* アクション 2 ボタン (上に境界線) */}
      <div className="mt-3 pt-3 border-t border-[#e7dcc9] flex gap-2">
        <Link
          href={`/courses/${review.course_id}/chapters/${review.chapter_id}/lessons/${review.lesson_id}?from=reviews`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#4a875b] hover:bg-[#34603f] text-white rounded-[10px] text-[12.5px] font-bold transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          レッスンを見る
        </Link>
        <Link
          href={`/courses/${review.course_id}/chapters/${review.chapter_id}/lessons/${review.lesson_id}?from=reviews&focus=review`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#fffdf8] hover:bg-[#f0e6d3] text-[#2b2620] border border-[#e7dcc9] rounded-[10px] text-[12.5px] font-bold transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          編集
        </Link>
      </div>
    </div>
  );
}

const ICO_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SearchIcon() {
  return (
    <svg {...ICO_PROPS} width="14" height="14">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...ICO_PROPS} width="12" height="12" className="flex-shrink-0">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChapterMarkIcon() {
  return (
    <svg {...ICO_PROPS} width="12" height="12" className="flex-shrink-0">
      <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
