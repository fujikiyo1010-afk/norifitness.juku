import Link from "next/link";
import {
  listPublicCourses,
  countPublicChapters,
  listLessonIdsInCourse,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import { SearchBox } from "./SearchBox";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublicCourses();

  // コースごとの章数 + レッスン進捗を並列取得
  const summaries = await Promise.all(
    courses.map(async (c) => {
      const [chapterCount, lessonIds] = await Promise.all([
        countPublicChapters(c.id),
        listLessonIdsInCourse(c.id),
      ]);
      const progressMap = await getMyLessonProgress(lessonIds);
      const completed = Array.from(progressMap.values()).filter(Boolean).length;
      const total = lessonIds.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { courseId: c.id, chapterCount, completed, total, percent };
    })
  );
  const summaryMap = new Map(summaries.map((s) => [s.courseId, s]));

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

        {/* 検索ボックス(Phase 2-7 でヘッダー共通化予定) */}
        <SearchBox />

        {courses.length === 0 ? (
          <p className="text-sm text-zinc-500">
            現在公開中のコースはありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => {
              const sum = summaryMap.get(c.id);
              const total = sum?.total ?? 0;
              const completed = sum?.completed ?? 0;
              const percent = sum?.percent ?? 0;
              const isFullyDone = total > 0 && percent === 100;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
                >
                  <Link
                    href={`/courses/${c.id}`}
                    className="group block space-y-3"
                  >
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

                    {/* 進捗バッジ + バー */}
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {sum?.chapterCount ?? 0} 章 / {completed} / {total} レッスン完了
                        </span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {percent}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isFullyDone
                              ? "bg-emerald-500"
                              : "bg-zinc-900 dark:bg-zinc-300"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
