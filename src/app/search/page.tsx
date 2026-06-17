import Link from "next/link";
import { searchLessons } from "@/lib/courses/search";
import { MemberHeader } from "@/components/MemberHeader";
import { getMyLessonProgress } from "@/lib/courses/queries";
import { SearchBox } from "@/app/courses/SearchBox";
import { SearchResultCard } from "@/components/SearchResultCard";

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
    <>
      <MemberHeader title="検索" fallbackHref="/" />
      <main className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="mx-auto w-full max-w-[460px] space-y-6">
        {query.length > 0 && (
          <div className="text-sm text-zinc-700">
            「{query}」 の結果 ({results.length} 件)
          </div>
        )}

        {/* 再検索ボックス(submit モード、Enter or ボタンで /search 再遷移) */}
        <SearchBox />

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

        {/* 結果一覧の下にも「コース一覧に戻る」リンク */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/courses"
            className="text-sm text-zinc-700 dark:text-zinc-300 underline hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            ← コース一覧へ戻る
          </Link>
        </div>
        </div>
      </main>
    </>
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
