import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  getPublicChapter,
  listPublicLessons,
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
            <Link
              href={`/courses/${courseId}`}
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {course.title}
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">{chapter.title}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            🎬 {chapter.title}
          </h1>
          {chapter.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {chapter.description}
            </p>
          )}
          <p className="text-xs text-zinc-500">{lessons.length} レッスン</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            レッスン一覧
          </h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-zinc-500">
              現在公開中のレッスンはありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {lessons.map((l) => (
                <li
                  key={l.id}
                  className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                >
                  <Link
                    href={`/courses/${courseId}/chapters/${chapterId}/lessons/${l.id}`}
                    className="group block space-y-1"
                  >
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-50 group-hover:underline">
                      {l.title}
                    </h3>
                    {l.meta_tags && l.meta_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {l.meta_tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {l.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-2">
                        {l.description}
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
