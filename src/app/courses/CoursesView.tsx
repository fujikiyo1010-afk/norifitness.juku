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
                ? "bg-[#34603f] border-[#34603f] text-white font-bold"
                : "bg-[#fffdf8] border-zinc-200 text-zinc-700 hover:border-zinc-300"
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
      <p className="text-sm text-[#6a6256]">現在公開中のコースはありません。</p>
    );
  }
  if (filtered.length === 0) {
    return (
      <p className="text-sm text-[#6a6256] text-center py-8">
        該当するコースはありません。
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {filtered.map((c) => (
        <li
          key={c.id}
          className="rounded bg-[#fffdf8] border border-zinc-200 shadow-sm overflow-hidden"
        >
          <Link
            href={`/courses/${c.id}`}
            className="group flex gap-3 p-3 hover:bg-[#e0d5be] transition-colors"
          >
            <CourseThumb title={c.title} />
            <CourseInfo course={c} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// =====================================================================
// サムネ (2026-06-17 タイトル別 個別 SVG ・ icons.tsx の統一ライブラリ使用)
// 5 コースのタイトルに含まれるキーワードで分岐
// 将来 sort_order を CourseSummary に含めるなら sort_order 分岐に置き換え可
// =====================================================================

type CourseTheme = { bg: string; stroke: string; path: string };

function pickCourseTheme(title: string): CourseTheme {
  // 限定ボディメイク = ロードマップ (TrendingUp 山型) ・ ティール緑 (現状維持 ・ ブランド色)
  if (title.includes("ボディメイク") || title.includes("ロードマップ"))
    return {
      bg: "#e0f2f1",
      stroke: "#34603f",
      path: "M4 16 9.5 10.5l3.2 3.2L20 6.4 M15.5 6.4H20v4.5",
    };
  // 限定講義 live = 動画 (Video 矩形 + 三角) ・ 薄ラベンダー
  if (title.includes("live") || title.includes("LIVE") || title.includes("講義"))
    return {
      bg: "#ede9fe",
      stroke: "#7c3aed",
      path: "M3 6h12.5v12H3z M15.5 10.2 21 7v10l-5.5-3.2",
    };
  // マインドセット = スパーク (Bolt 雷) ・ 薄イエロー
  if (title.includes("マインドセット") || title.includes("コンテンツ"))
    return {
      bg: "#fef3c7",
      stroke: "#ca8a04",
      path: "M13 2.5 4.5 13.2a.6.6 0 0 0 .5.95H11l-1 7.35 8.5-10.7a.6.6 0 0 0-.5-.95H13Z",
    };
  // 筋トレフォーム = ダンベル ・ 薄ピーチ
  if (title.includes("フォーム") || title.includes("筋トレ"))
    return {
      bg: "#ffedd5",
      stroke: "#ea580c",
      path: "M8.5 12h7 M6 8.6v6.8 M3.6 10.2v3.6 M18 8.6v6.8 M20.4 10.2v3.6",
    };
  // ダイエットレシピ = チェック (CheckCircle) ・ 薄ピンク
  if (title.includes("レシピ") || title.includes("ダイエット"))
    return {
      bg: "#fce7f3",
      stroke: "#db2777",
      path: "M3.4 12a8.6 8.6 0 1 0 17.2 0 8.6 8.6 0 1 0-17.2 0 M8.5 12l2.4 2.4 4.6-4.8",
    };
  // フォールバック = BookOpen ・ ティール緑
  return {
    bg: "#e0f2f1",
    stroke: "#34603f",
    path: "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 M12 6.5C13.5 5 16 4.5 20 4.5v13c-4 0-6.5.5-8 2 M12 6.5V21",
  };
}

function CourseThumb({ title }: { title: string }) {
  const theme = pickCourseTheme(title);
  return (
    <div
      className="w-20 h-20 rounded-[10px] flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: theme.bg }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: `<path d="${theme.path}" />` }}
      />
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
      ? "text-[#6a6256]"
      : "text-[#34603f]";

  return (
    <div className="flex-1 min-w-0">
      <h2 className="text-[13px] font-bold text-[#2b2620] leading-[1.4] mb-1 line-clamp-2 group-hover:underline">
        {c.title}
      </h2>
      <div className="text-[11px] text-[#6a6256] mb-1.5">
        {c.chapter_count} 章 ・ {c.total_lessons} レッスン
      </div>
      <div className="h-[5px] rounded-full bg-zinc-100 overflow-hidden mb-1">
        <div
          className="h-full bg-[#4a875b] rounded-full transition-[width] duration-500"
          style={{ width: `${c.percent}%` }}
        />
      </div>
      <div className={`text-[10px] font-bold font-mono ${progressTextClass}`}>
        {progressText}
      </div>
    </div>
  );
}
