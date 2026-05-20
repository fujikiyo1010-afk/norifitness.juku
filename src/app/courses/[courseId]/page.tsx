import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  listPublicChapters,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import { createClient } from "@/lib/supabase/server";
import { CourseAccordion, type AccordionChapter } from "./CourseAccordion";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string }>;

const nowIso = () => new Date().toISOString();

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

  // 章一覧
  const chapters = await listPublicChapters(courseId);
  const chapterIds = chapters.map((c) => c.id);

  // 全章配下の公開済みレッスンを 1 クエリで取得
  const supabase = await createClient();
  const lessonsByChapter = new Map<string, AccordionChapter["lessons"]>();
  let allLessonIds: string[] = [];

  if (chapterIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, chapter_id, title, meta_tags, sort_order")
      .in("chapter_id", chapterIds)
      .or(`released_at.is.null,released_at.lte.${nowIso()}`)
      .order("sort_order", { ascending: true });

    (lessons ?? []).forEach((l) => {
      const arr = lessonsByChapter.get(l.chapter_id as string) ?? [];
      arr.push({
        id: l.id as string,
        title: l.title as string,
        meta_tags: (l.meta_tags as string[] | null) ?? null,
        sort_order: l.sort_order as number,
      });
      lessonsByChapter.set(l.chapter_id as string, arr);
    });
    allLessonIds = (lessons ?? []).map((l) => l.id as string);
  }

  // 進捗マップ取得
  const progressMap = await getMyLessonProgress(allLessonIds);
  const initialProgress: Record<string, boolean> = {};
  progressMap.forEach((v, k) => {
    initialProgress[k] = v;
  });

  // AccordionChapter 形式に組み立て
  const accordionChapters: AccordionChapter[] = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    sort_order: c.sort_order,
    lessons: lessonsByChapter.get(c.id) ?? [],
  }));

  // コース全体の進捗集計
  const totalLessons = allLessonIds.length;
  const completedLessons = Object.values(initialProgress).filter(Boolean).length;
  const coursePercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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

          {/* コース全体の進捗 */}
          <div className="pt-2 space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">
                全体進捗: {completedLessons} / {totalLessons} レッスン
              </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {coursePercent}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  coursePercent === 100 && totalLessons > 0
                    ? "bg-emerald-500"
                    : "bg-zinc-900 dark:bg-zinc-300"
                }`}
                style={{ width: `${coursePercent}%` }}
              />
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              章一覧 ({chapters.length} 章)
            </h2>
            <p className="text-xs text-zinc-500">章をクリックで開閉</p>
          </div>
          {chapters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              現在公開中の章はありません。新しい章の公開をお待ちください。
            </p>
          ) : (
            <CourseAccordion
              courseId={courseId}
              chapters={accordionChapters}
              initialProgress={initialProgress}
            />
          )}
        </section>
      </div>
    </main>
  );
}
