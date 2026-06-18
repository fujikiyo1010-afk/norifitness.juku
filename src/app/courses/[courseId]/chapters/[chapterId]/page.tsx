import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  getPublicChapter,
  listPublicLessons,
  getMyLessonProgress,
} from "@/lib/courses/queries";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string; chapterId: string }>;

export default async function StudentChapterPage({
  params,
}: {
  params: RouteParams;
}) {
  const { courseId, chapterId } = await params;

  const [course, chapter] = await Promise.all([
    getPublicCourse(courseId),
    getPublicChapter(courseId, chapterId),
  ]);
  if (!course || !chapter) {
    notFound();
  }

  const lessons = await listPublicLessons(chapterId);
  const progressMap = await getMyLessonProgress(lessons.map((l) => l.id));
  const completedCount = lessons.filter((l) => progressMap.get(l.id)).length;
  const totalCount = lessons.length;
  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8 bg-[#f9f5ed]">
      <div className="mx-auto w-full max-w-[460px] space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-[#6a6256] space-x-1">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span>/</span>
            <Link href="/courses" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              コース一覧
            </Link>
            <span>/</span>
            <Link
              href={`/courses/${courseId}`}
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {course.title}
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">{chapter.title}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[#2b2620] dark:text-zinc-50">
            🎬 {chapter.title}
          </h1>
          {chapter.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {chapter.description}
            </p>
          )}
          <div className="pt-1 space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-zinc-600 dark:text-[#a59b8c]">
                {completedCount} / {totalCount} レッスン完了
              </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {percent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percent === 100 && totalCount > 0
                    ? "bg-emerald-500"
                    : "bg-zinc-900 dark:bg-zinc-300"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#2b2620] dark:text-zinc-50">
            レッスン一覧
          </h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-[#6a6256]">
              現在公開中のレッスンはありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {lessons.map((l) => {
                const done = progressMap.get(l.id) === true;
                return (
                  <li
                    key={l.id}
                    className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-[#fffdf8] dark:bg-zinc-900 p-4 flex items-start gap-3"
                  >
                    <span
                      aria-label={done ? "完了済み" : "未完了"}
                      className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        done
                          ? "bg-emerald-500 text-white"
                          : "border border-zinc-300 dark:border-zinc-700 text-[#a59b8c]"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/courses/${courseId}/chapters/${chapterId}/lessons/${l.id}`}
                        className="group block"
                      >
                        <h3
                          className={`font-medium group-hover:underline ${
                            done
                              ? "text-[#6a6256] dark:text-[#a59b8c]"
                              : "text-[#2b2620] dark:text-zinc-50"
                          }`}
                        >
                          {l.title}
                        </h3>
                      </Link>
                      {l.meta_tags && l.meta_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {l.meta_tags.map((tag) => (
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
                      {l.description && (
                        <p className="text-sm text-zinc-600 dark:text-[#a59b8c] whitespace-pre-wrap line-clamp-2">
                          {l.description}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
