"use client";

import { useEffect, useState } from "react";
import { SearchBox } from "@/app/courses/SearchBox";
import {
  SearchResultsList,
  type SearchResultItem,
} from "@/components/SearchResultsList";
import {
  CourseAccordion,
  type AccordionChapter,
  type AccordionExamInfo,
} from "./CourseAccordion";

type ApiResponse = {
  query: string;
  results: SearchResultItem[];
};

const DEBOUNCE_MS = 250;

/**
 * コース詳細ページのクライアントビュー。
 * 検索ボックス + (アコーディオン or コース内検索結果) を切り替える。
 *
 * 検索スコープ: このコース内のレッスンのみ (course_id でフィルタ)
 */
export function CourseDetailView({
  courseId,
  chapters,
  initialProgress,
  currentLessonId = null,
  examsByChapterId = {},
}: {
  courseId: string;
  chapters: AccordionChapter[];
  initialProgress: Record<string, boolean>;
  currentLessonId?: string | null;
  examsByChapterId?: Record<string, AccordionExamInfo>;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const params = new URLSearchParams({
      q: debounced,
      course_id: courseId,
    });

    fetch(`/api/search/lessons?${params.toString()}`)
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
  }, [debounced, courseId]);

  const isSearching = debounced.length > 0;

  return (
    <div className="space-y-6">
      <SearchBox
        value={query}
        onChange={setQuery}
        submitOnEnter={false}
        placeholder="このコース内で動画を検索"
      />

      {!isSearching ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              章一覧 ({chapters.length} 章)
            </h2>
            {chapters.length > 0 && (
              <p className="text-xs text-zinc-500">章をクリックで開閉</p>
            )}
          </div>
          {chapters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              現在公開中の章はありません。新しい章の公開をお待ちください。
            </p>
          ) : (
            <CourseAccordion
              courseId={courseId}
              chapters={chapters}
              initialProgress={initialProgress}
              currentLessonId={currentLessonId}
              examsByChapterId={examsByChapterId}
            />
          )}
        </section>
      ) : (
        <SearchResultsList
          query={debounced}
          results={results}
          loading={loading}
          error={error}
          onClear={() => setQuery("")}
          clearLabel="✕ クリアして章一覧に戻る"
        />
      )}
    </div>
  );
}
