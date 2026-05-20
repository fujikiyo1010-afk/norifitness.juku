import {
  SearchResultCard,
  type SearchResultCardData,
} from "./SearchResultCard";

export type SearchResultItem = SearchResultCardData & {
  is_completed: boolean;
};

/**
 * 検索結果リストの汎用表示コンポーネント。
 * ライブ検索 (CoursesView / CourseDetailView) と /search ページで共通利用。
 */
export function SearchResultsList({
  query,
  results,
  loading,
  error,
  countLabel = "件",
  onClear,
  clearLabel = "✕ クリアして一覧に戻る",
}: {
  query: string;
  results: SearchResultItem[];
  loading: boolean;
  error: string | null;
  countLabel?: string;
  /** クリアボタン押下時のコールバック。指定時のみテキストリンクを表示 */
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          🔍 「<span className="font-medium">{query}</span>」の検索結果{" "}
          {loading ? "(検索中…)" : `(${results.length} ${countLabel})`}
        </p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {clearLabel}
          </button>
        )}
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
