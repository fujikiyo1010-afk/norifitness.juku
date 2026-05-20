import Link from "next/link";
import { searchLessons, type SearchResult } from "@/lib/courses/search";
import { getMyLessonProgress } from "@/lib/courses/queries";
import { SearchBox } from "@/app/courses/SearchBox";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query.length > 0 ? await searchLessons(query) : [];
  const progressMap = await getMyLessonProgress(results.map((r) => r.id));

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500 space-x-1">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span>/</span>
            <Link href="/courses" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              コース一覧
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">検索結果</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            🔍 検索結果
            {query.length > 0 && (
              <>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400 font-normal">
                  「{query}」
                </span>
                <span className="ml-2 text-sm text-zinc-500 font-normal">
                  ({results.length} 件)
                </span>
              </>
            )}
          </h1>
        </header>

        {/* 再検索ボックス */}
        <SearchBox initialQuery={query} />

        {/* 結果リスト */}
        {query.length === 0 ? (
          <p className="text-sm text-zinc-500">
            検索したいキーワードを入力してください。
          </p>
        ) : results.length === 0 ? (
          <ZeroResults query={query} />
        ) : (
          <ul className="space-y-3">
            {results.map((r) => (
              <SearchResultCard
                key={r.id}
                result={r}
                query={query}
                isCompleted={progressMap.get(r.id) === true}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SearchResultCard({
  result,
  query,
  isCompleted,
}: {
  result: SearchResult;
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
          {/* タイトル */}
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

          {/* パンくず: コース / 章 */}
          <p className="text-xs text-zinc-500">
            📖 {result.course_title} / 📑 {result.chapter_title}
          </p>

          {/* タグ(クリックで再検索) */}
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

          {/* 説明文の抜粋 */}
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

function ZeroResults({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-3">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        「<span className="font-medium">{query}</span>」に該当するレッスンが見つかりませんでした。
      </p>
      <p className="text-xs text-zinc-500">
        別のキーワード(部位名、種目名 等)でお試しください。
      </p>
      <Link
        href="/courses"
        className="inline-block text-sm text-zinc-900 dark:text-zinc-50 underline"
      >
        → コース一覧に戻る
      </Link>
    </div>
  );
}

/** クエリにマッチした部分を <mark> でハイライト表示 */
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
