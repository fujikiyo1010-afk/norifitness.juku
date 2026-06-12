import Link from "next/link";
import {
  listPublicCourses,
  countPublicChapters,
  listLessonIdsInCourse,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import { CoursesView } from "./CoursesView";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublicCourses();

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
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        chapter_count: chapterCount,
        total_lessons: total,
        completed_lessons: completed,
        percent,
      };
    })
  );

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-[460px] space-y-6">
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
            学びたいコースを選んでください。検索ボックスから動画を直接探すこともできます。
          </p>
        </header>

        <CoursesView initialCourses={summaries} />
      </div>
    </main>
  );
}
