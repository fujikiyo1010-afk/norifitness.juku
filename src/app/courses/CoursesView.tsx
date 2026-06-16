"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SearchBox } from "./SearchBox";
import {
  SearchResultsList,
  type SearchResultItem,
} from "@/components/SearchResultsList";

/**
 * コース一覧 (Client Component)
 *
 * 設計元: docs/03_design_mocks/screens_phase1.html L621-730 「② コース一覧」
 *
 * 構成:
 *   - 検索ボックス (既存 SearchBox、 デバウンス 250ms で /api/search/lessons)
 *   - 検索クエリなし → CourseFilterTabs (4 種) + CoursesList (横並びカード)
 *   - 検索クエリあり → SearchResultsList
 *
 * フィルタ状態 (CourseSummary.percent から派生):
 *   - completed   = percent 100 (全レッスン完了)
 *   - in_progress = 0 < percent < 100
 *   - not_started = percent 0 or total_lessons 0
 *
 * サムネ: Phase 4 #15 線① 前倒し = 全コース共通 BookOpen SVG。
 *        コース固有アイコンへの差し替えは線② で対応 (= のり氏判断)。
 */

type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  chapter_count: number;
  total_lessons: number;
  completed_lessons: number;
  percent: number;
};

type ApiResponse = {
  query: string;
  results: SearchResultItem[];
};

type FilterKey = "all" | "in_progress" | "not_started" | "completed";

const DEBOUNCE_MS = 250;

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "すべて",
  in_progress: "進行中",
  not_started: "未着手",
  completed: "完了",
};

function getCourseState(c: CourseSummary): Exclude<FilterKey, "all"> {
  if (c.total_lessons > 0 && c.percent === 100) return "completed";
  if (c.percent === 0 || c.total_lessons === 0) return "not_started";
  return "in_progress";
}

export function CoursesView({ initialCourses }: { initialCourses: CourseSummary[] }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debounced.length === 0) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let aborted = false;
    setLoading(true);
    setError(null);

    fetch(`/api/search/lessons?q=${encodeURIComponent(debounced)}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`検索に失敗しました (HTTP ${r.status})`);
        }
        return (await r.json()) as ApiResponse;
      })
      .then((data) => {
        if (aborted) return;
        setResults(data.results ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (aborted) return;
        setError(e instanceof Error ? e.message : "検索エラーが発生しました");
        setLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [debounced]);

  const isSearching = debounced.length > 0;

  return (
    <div className="space-y-4">
      <SearchBox value={query} onChange={setQuery} submitOnEnter={false} />

      {!isSearching ? (
        <>
          <CourseFilterTabs
            filter={filter}
            onChange={setFilter}
            courses={initialCourses}
          />
          <CoursesList courses={initialCourses} filter={filter} />
        </>
      ) : (
        <SearchResultsList
          query={debounced}
          results={results}
          loading={loading}
          error={error}
          onClear={() => setQuery("")}
        />
      )}
    </div>
  );
}

// =====================================================================
// フィルタタブ (件数バッジ付き、 横スクロール、 active = ティール緑塗り)
// =====================================================================

function CourseFilterTabs({
  filter,
  onChange,
  courses,
}: {
  filter: FilterKey;
  onChange: (next: FilterKey) => void;
  courses: CourseSummary[];
}) {
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: courses.length,
      in_progress: 0,
      not_started: 0,
      completed: 0,
    };
    for (const course of courses) {
      c[getCourseState(course)] += 1;
    }
    return c;
  }, [courses]);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
        const active = filter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap border transition-colors ${
              active
                ? "bg-[#00695c] border-[#00695c] text-white font-bold"
                : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
            }`}
          >
            {FILTER_LABELS[key]} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// コースリスト (横並びカード ・ モック L656-704 準拠)
// =====================================================================

function CoursesList({
  courses,
  filter,
}: {
  courses: CourseSummary[];
  filter: FilterKey;
}) {
  const filtered = useMemo(() => {
    if (filter === "all") return courses;
    return courses.filter((c) => getCourseState(c) === filter);
  }, [courses, filter]);

  if (courses.length === 0) {
    return (
      <p className="text-sm text-zinc-500">現在公開中のコースはありません。</p>
    );
  }
  if (filtered.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        該当するコースはありません。
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {filtered.map((c) => (
        <li
          key={c.id}
          className="rounded bg-white border border-zinc-200 shadow-sm overflow-hidden"
        >
          <Link
            href={`/courses/${c.id}`}
            className="group flex gap-3 p-3 hover:bg-zinc-50 transition-colors"
          >
            <CourseThumb />
            <CourseInfo course={c} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// =====================================================================
// サムネ (Phase 4 #15 線① 前倒し = 全コース共通 BookOpen 線画)
// 線② で各コース固有アイコンに差し替え予定 (= のり氏判断、 別 todo)
// =====================================================================

function CourseThumb() {
  return (
    <div className="w-20 h-20 rounded-[10px] bg-[#e0f2f1] flex items-center justify-center flex-shrink-0">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#00695c"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    </div>
  );
}

// =====================================================================
// 右側情報 (タイトル + メタ + 進捗バー + 進捗テキスト)
// =====================================================================

function CourseInfo({ course: c }: { course: CourseSummary }) {
  const state = getCourseState(c);
  let progressText: string;
  if (state === "not_started") {
    progressText = "未着手";
  } else if (state === "completed") {
    progressText = `✓ 完了 (${c.total_lessons}/${c.total_lessons})`;
  } else {
    progressText = `進行中 ${c.percent}% (${c.completed_lessons}/${c.total_lessons})`;
  }
  const progressTextClass =
    state === "not_started"
      ? "text-zinc-500"
      : "text-[#00695c]";

  return (
    <div className="flex-1 min-w-0">
      <h2 className="text-[13px] font-bold text-zinc-900 leading-[1.4] mb-1 line-clamp-2 group-hover:underline">
        {c.title}
      </h2>
      <div className="text-[11px] text-zinc-500 mb-1.5">
        {c.chapter_count} 章 ・ {c.total_lessons} レッスン
      </div>
      <div className="h-[5px] rounded-full bg-zinc-100 overflow-hidden mb-1">
        <div
          className="h-full bg-[#00897b] rounded-full transition-[width] duration-500"
          style={{ width: `${c.percent}%` }}
        />
      </div>
      <div className={`text-[10px] font-bold font-mono ${progressTextClass}`}>
        {progressText}
      </div>
    </div>
  );
}
