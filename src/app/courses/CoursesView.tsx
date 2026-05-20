"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchBox } from "./SearchBox";
import {
  SearchResultCard,
  type SearchResultCardData,
} from "@/components/SearchResultCard";

type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  chapter_count: number;
  total_lessons: number;
  completed_lessons: number;
  percent: number;
};

type ApiResult = SearchResultCardData & {
  is_completed: boolean;
};

type ApiResponse = {
  query: string;
  results: ApiResult[];
};

const DEBOUNCE_MS = 250;

export function CoursesView({ initialCourses }: { initialCourses: CourseSummary[] }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<ApiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // デバウンス: タイプが落ち着いてから検索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // デバウンス済みクエリで検索 API を叩く
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
    <div className="space-y-6">
      <SearchBox
        value={query}
        onChange={setQuery}
        submitOnEnter={false} /* ライブ検索なので submit 不要 */
        autoFocus={false}
      />

      {!isSearching ? (
        // 検索クエリが空 = 通常のコース一覧表示
        <CoursesGrid courses={initialCourses} />
      ) : (
        // 検索中
        <SearchResults
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

function CoursesGrid({ courses }: { courses: CourseSummary[] }) {
  if (courses.length === 0) {
    return (
      <p className="text-sm text-zinc-500">現在公開中のコースはありません。</p>
    );
  }
  return (
    <ul className="space-y-3">
      {courses.map((c) => {
        const isFullyDone = c.total_lessons > 0 && c.percent === 100;
        return (
          <li
            key={c.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
          >
            <Link href={`/courses/${c.id}`} className="group block space-y-3">
              <div className="space-y-1">
                <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 group-hover:underline">
                  {c.title}
                </h2>
                {c.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {c.description}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {c.chapter_count} 章 / {c.completed_lessons} / {c.total_lessons}
                    {" "}レッスン完了
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {c.percent}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isFullyDone
                        ? "bg-emerald-500"
                        : "bg-zinc-900 dark:bg-zinc-300"
                    }`}
                    style={{ width: `${c.percent}%` }}
                  />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SearchResults({
  query,
  results,
  loading,
  error,
  onClear,
}: {
  query: string;
  results: ApiResult[];
  loading: boolean;
  error: string | null;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          🔍 「<span className="font-medium">{query}</span>」の検索結果{" "}
          {loading ? "(検索中…)" : `(${results.length} 件)`}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-600 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ✕ クリアして一覧に戻る
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      {!loading && results.length === 0 && !error ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            該当するレッスンが見つかりませんでした。
          </p>
          <p className="text-xs text-zinc-500">
            別のキーワード(部位名、種目名 等)でお試しください。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <SearchResultCard
              key={r.id}
              result={r}
              query={query}
              isCompleted={r.is_completed}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
