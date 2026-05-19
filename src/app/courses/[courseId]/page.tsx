import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  listPublicChapters,
  countPublicLessons,
} from "@/lib/courses/queries";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string }>;

export default async function StudentCoursePage({
  params,
}: {
  params: RouteParams;
}) {
  const { courseId } = await params;

  const course = await getPublicCourse(courseId);
  if (!course) {
    notFound();
  }

  const chapters = await listPublicChapters(courseId);
  const lessonCounts = await Promise.all(
    chapters.map((ch) => countPublicLessons(ch.id).then((n) => [ch.id, n] as const))
  );
  const countMap = new Map(lessonCounts);

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
            <span className="text-zinc-700 dark:text-zinc-300">{course.title}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            📖 {course.title}
          </h1>
          {course.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {course.description}
            </p>
          )}
          <p className="text-xs text-zinc-500">{chapters.length} 章 公開中</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            章一覧
          </h2>
          {chapters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              現在公開中の章はありません。新しい章の公開をお待ちください。
            </p>
          ) : (
            <ul className="space-y-2">
              {chapters.map((ch) => (
                <li
                  key={ch.id}
                  className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                >
                  <Link
                    href={`/courses/${courseId}/chapters/${ch.id}`}
                    className="group block space-y-1"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-50 group-hover:underline">
                        {ch.title}
                      </h3>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {countMap.get(ch.id) ?? 0} レッスン
                      </span>
                    </div>
                    {ch.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {ch.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
