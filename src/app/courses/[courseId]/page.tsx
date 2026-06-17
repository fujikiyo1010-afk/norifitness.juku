import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  listPublicChapters,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import { createClient } from "@/lib/supabase/server";
import { type AccordionChapter } from "./CourseAccordion";
import { CourseDetailView } from "./CourseDetailView";
import { MemberHeader } from "@/components/MemberHeader";

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

  // 進捗マップ
  const progressMap = await getMyLessonProgress(allLessonIds);
  const initialProgress: Record<string, boolean> = {};
  progressMap.forEach((v, k) => {
    initialProgress[k] = v;
  });

  // 章 sort_order → レッスン sort_order の順で「最初の未完了レッスン」 を探す ・ 「続きから」 CTA 用
  let firstUnfinished: {
    chapterId: string;
    lessonId: string;
    chapterSortOrder: number;
    lessonSortOrder: number;
    title: string;
  } | null = null;
  for (const ch of chapters) {
    const lessons = lessonsByChapter.get(ch.id) ?? [];
    for (const l of lessons) {
      if (!initialProgress[l.id]) {
        firstUnfinished = {
          chapterId: ch.id,
          lessonId: l.id,
          chapterSortOrder: ch.sort_order,
          lessonSortOrder: l.sort_order,
          title: l.title,
        };
        break;
      }
    }
    if (firstUnfinished) break;
  }

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
    <>
      <MemberHeader title="コース詳細" fallbackHref="/courses" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-zinc-50">
        <div className="mx-auto w-full max-w-[460px] space-y-4">
        {/* ヒーロー (モック準拠 ・ 緑グラデ + 大サムネ + 進捗 + 続きから CTA) */}
        <section className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#00897b] to-[#00695c] text-white p-5">
          {/* 大サムネ枠 */}
          <div className="w-full aspect-[16/9] rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/95"
            >
              <circle cx="13" cy="4" r="2" />
              <path d="M4 22 8.5 11l3 3 4-6 6 9" />
              <path d="m11.5 10.5 2-7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold leading-tight mb-1">
            {course.title}
          </h1>
          <div className="text-[11px] opacity-90 mb-2.5">
            {chapters.length} 章 ・ {totalLessons} レッスン ・ 全体{" "}
            {coursePercent}% ({completedLessons}/{totalLessons})
          </div>
          {/* 進捗バー */}
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden mb-3">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${coursePercent}%` }}
            />
          </div>
          {/* 続きから CTA */}
          {firstUnfinished ? (
            <Link
              href={`/courses/${courseId}/chapters/${firstUnfinished.chapterId}/lessons/${firstUnfinished.lessonId}`}
              className="block rounded-xl bg-white text-[#00695c] py-3 px-4 text-sm font-bold text-center shadow-[0_4px_0_rgba(0,77,64,0.5)] hover:bg-zinc-50 transition-colors"
            >
              ▶ 続きから ・ L{firstUnfinished.lessonSortOrder}「
              {firstUnfinished.title}」
            </Link>
          ) : totalLessons > 0 ? (
            <div className="rounded-xl bg-white/90 text-[#004d40] py-3 px-4 text-sm font-bold text-center">
              ✓ 全レッスン完了
            </div>
          ) : null}
        </section>

        {/* 説明 (任意) */}
        {course.description && (
          <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed px-1">
            {course.description}
          </p>
        )}

        <CourseDetailView
          courseId={courseId}
          chapters={accordionChapters}
          initialProgress={initialProgress}
          currentLessonId={firstUnfinished?.lessonId ?? null}
        />
        </div>
      </main>
    </>
  );
}
