import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 完了履歴 (/my-log/completed) ・ 2026-06-17 線① 新設
 *
 * 視聴完了したレッスンを 新しい順 (completed_at desc) に一覧表示。
 *
 * 実装方針:
 *   - lesson_progress を起点に lesson + chapter + course を取得 (4 クエリ並列)
 *   - 旧版 (3 クエリ + Map look-up) で 一覧が表示されない問題があったため、 個別 SELECT パターンに統一
 *   - RLS: lesson_progress = self / lessons + chapters + courses = released_at AND is_published
 */
export default async function CompletedLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-log/completed");

  // 1) 完了 lesson_progress を取得
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_completed", true)
    .order("completed_at", { ascending: false });

  type ProgressRow = {
    lesson_id: string;
    completed_at: string | null;
    updated_at: string;
  };
  const rows = (progress ?? []) as ProgressRow[];
  const lessonIds = rows.map((r) => r.lesson_id);

  // 2) lessons + chapters + courses を取得 (lessonIds が空の時は skip)
  let lessons: { id: string; chapter_id: string; title: string }[] = [];
  let chapters: { id: string; course_id: string; title: string }[] = [];
  let courses: { id: string; title: string }[] = [];

  if (lessonIds.length > 0) {
    const lessonsRes = await supabase
      .from("lessons")
      .select("id, chapter_id, title")
      .in("id", lessonIds);
    lessons = lessonsRes.data ?? [];

    const chapterIds = [...new Set(lessons.map((l) => l.chapter_id))];
    if (chapterIds.length > 0) {
      const chaptersRes = await supabase
        .from("chapters")
        .select("id, course_id, title")
        .in("id", chapterIds);
      chapters = chaptersRes.data ?? [];

      const courseIds = [...new Set(chapters.map((c) => c.course_id))];
      if (courseIds.length > 0) {
        const coursesRes = await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds);
        courses = coursesRes.data ?? [];
      }
    }
  }

  const lessonsMap = new Map(lessons.map((l) => [l.id, l]));
  const chaptersMap = new Map(chapters.map((c) => [c.id, c]));
  const coursesMap = new Map(courses.map((c) => [c.id, c.title]));

  // 3) 表示行を組み立て (順序は progress 順 = 完了日新しい順)
  const entries = rows.flatMap((r) => {
    const lesson = lessonsMap.get(r.lesson_id);
    if (!lesson) return [];
    const chapter = chaptersMap.get(lesson.chapter_id);
    const courseTitle = chapter ? coursesMap.get(chapter.course_id) ?? "" : "";
    const completedDate = r.completed_at ?? r.updated_at;
    return [
      {
        lessonId: lesson.id,
        chapterId: lesson.chapter_id,
        courseId: chapter?.course_id ?? null,
        lessonTitle: lesson.title,
        chapterTitle: chapter?.title ?? "",
        courseTitle,
        completedDate,
      },
    ];
  });

  // 4) progress 件数 ≠ entries 件数 のとき、 lesson が引けなかった (= 章未公開や削除) 件数を表示
  const orphanCount = rows.length - entries.length;

  return (
    <>
      <MemberHeader title="完了履歴" fallbackHref="/my-log" />
      <main className="min-h-screen bg-[#ebdfc6]">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          {/* サマリ */}
          <div className="mb-5 px-1">
            <p className="text-[12px] text-[#6a6256]">
              これまでに視聴完了したレッスン
            </p>
            <p className="text-[28px] font-bold text-[#34603f] font-mono leading-none mt-1">
              {rows.length}
              <span className="text-[12px] text-[#6a6256] ml-1">レッスン</span>
            </p>
            {orphanCount > 0 ? (
              <p className="text-[10px] text-[#a59b8c] mt-1">
                ※ {orphanCount} 件は元レッスンが非公開のため詳細を表示できません
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <div className="bg-[#fffdf8] border border-dashed border-[#e7dcc9] rounded-2xl p-8 text-center">
              <p className="text-[13px] text-[#6a6256] leading-relaxed">
                {rows.length === 0
                  ? "まだ完了したレッスンはありません。"
                  : "表示できる完了レッスンがありません。"}
                <br />
                コースから学習を始めましょう。
              </p>
              <Link
                href="/courses"
                className="inline-block mt-4 bg-[#4a875b] text-white rounded-xl px-5 py-2.5 text-[12px] font-bold hover:bg-[#34603f] transition-colors"
              >
                コース一覧へ →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((e) => (
                <li key={e.lessonId}>
                  <Link
                    href={
                      e.courseId
                        ? `/courses/${e.courseId}/chapters/${e.chapterId}/lessons/${e.lessonId}`
                        : "#"
                    }
                    className="block bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3.5 hover:border-[#4a875b] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#4a875b] text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#6a6256] truncate mb-0.5">
                          {e.courseTitle} ・ {e.chapterTitle}
                        </div>
                        <div className="text-[13px] font-bold text-[#2b2620] leading-snug">
                          {e.lessonTitle}
                        </div>
                        <div className="text-[10px] text-[#a59b8c] font-mono mt-1">
                          {new Date(e.completedDate).toLocaleDateString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </div>
                      </div>
                      <span className="text-[#a59b8c] text-sm flex-shrink-0">
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
