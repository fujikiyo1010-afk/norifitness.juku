import {
  listPublicCourses,
  countPublicChapters,
  listLessonIdsInCourse,
  getMyLessonProgress,
} from "@/lib/courses/queries";
import { CoursesView } from "./CoursesView";
import { MemberHeader } from "@/components/MemberHeader";

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
    <>
      <MemberHeader title="コース" fallbackHref="/" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px] space-y-4">
          <CoursesView initialCourses={summaries} />
        </div>
      </main>
    </>
  );
}
