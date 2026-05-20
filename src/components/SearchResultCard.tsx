import Link from "next/link";

export type SearchResultCardData = {
  id: string;
  title: string;
  description: string | null;
  meta_tags: string[] | null;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
};

export function SearchResultCard({
  result,
  query,
  isCompleted,
}: {
  result: SearchResultCardData;
  query: string;
  isCompleted: boolean;
}) {
  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start gap-3">
        {/* 完了アイコン */}
        <span
          aria-label={isCompleted ? "完了済み" : "未完了"}
          className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isCompleted
              ? "bg-emerald-500 text-white"
              : "border border-zinc-300 dark:border-zinc-700 text-zinc-400"
          }`}
        >
          {isCompleted ? "✓" : ""}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <Link
            href={`/courses/${result.course_id}/chapters/${result.chapter_id}/lessons/${result.id}`}
            className="group block"
          >
            <h3
              className={`font-medium text-base group-hover:underline ${
                isCompleted
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              <Highlight text={result.title} query={query} />
            </h3>
          </Link>

          <p className="text-xs text-zinc-500">
            📖 {result.course_title} / 📑 {result.chapter_title}
          </p>

          {result.meta_tags && result.meta_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.meta_tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {result.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
              <Highlight text={result.description} query={query} />
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** クエリにマッチした部分を <mark> でハイライト */
export function Highlight({ text, query }: { text: string; query: string }) {
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
