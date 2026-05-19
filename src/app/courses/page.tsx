import Link from "next/link";
import { listPublicCourses, countPublicChapters } from "@/lib/courses/queries";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublicCourses();
  const chapterCounts = await Promise.all(
    courses.map((c) => countPublicChapters(c.id).then((n) => [c.id, n] as const))
  );
  const countMap = new Map(chapterCounts);

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span> / コース一覧</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            📚 コース一覧
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            学びたいコースを選んでください
          </p>
        </header>

        {courses.length === 0 ? (
          <p className="text-sm text-zinc-500">
            現在公開中のコースはありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
              >
                <Link
                  href={`/courses/${c.id}`}
                  className="group block space-y-2"
                >
                  <h2 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 group-hover:underline">
                    {c.title}
                  </h2>
                  {c.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {c.description}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    {countMap.get(c.id) ?? 0} 章 / 学習を始める →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
