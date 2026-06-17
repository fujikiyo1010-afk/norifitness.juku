import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 完了履歴 (/my-log/completed) ・ 2026-06-17 線① 新設
 *
 * 視聴完了したレッスンを 新しい順 に一覧表示。
 * 章 + コース名 + 完了日 + 「もう一度見る」 リンク。
 *
 * 過去 docs: docs/03_design_mocks/recovered/学習画面_(ハブ型_確定版).html ・ 4 ハブカード目
 */
export default async function CompletedLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-log/completed");

  // 完了 lesson_id + 完了日を取得 (新しい順)
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at, last_watched_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_completed", true)
    .order("completed_at", { ascending: false, nullsFirst: false });

  type ProgressRow = {
    lesson_id: string;
    completed_at: string | null;
    last_watched_at: string | null;
    updated_at: string;
  };
  const rows = (progress ?? []) as ProgressRow[];
  const lessonIds = rows.map((r) => r.lesson_id);

  // lesson + chapter + course の情報を join 風に取る (3 クエリ並列)
  const [lessonsRes, chaptersRes, coursesRes] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("lessons")
          .select("id, chapter_id, title, sort_order")
          .in("id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; chapter_id: string; title: string; sort_order: number }[] }),
    supabase.from("chapters").select("id, course_id, title, sort_order"),
    supabase.from("courses").select("id, title"),
  ]);

  const lessonsMap = new Map(
    (lessonsRes.data ?? []).map((l) => [l.id, l])
  );
  const chaptersMap = new Map(
    (chaptersRes.data ?? []).map((c) => [c.id, c])
  );
  const coursesMap = new Map(
    (coursesRes.data ?? []).map((c) => [c.id, c.title])
  );

  // 表示行を組み立て (順序は progress 順 = 完了日新しい順)
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

  return (
    <>
      <MemberHeader title="完了履歴" fallbackHref="/my-log" />
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          {/* サマリ */}
          <div className="mb-5 px-1">
            <p className="text-[12px] text-zinc-500">
              これまでに視聴完了したレッスン
            </p>
            <p className="text-[28px] font-bold text-[#00695c] font-mono leading-none mt-1">
              {entries.length}
              <span className="text-[12px] text-zinc-500 ml-1">レッスン</span>
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white border border-dashed border-[#e8ebe9] rounded-2xl p-8 text-center">
              <p className="text-[13px] text-zinc-500 leading-relaxed">
                まだ完了したレッスンはありません。
                <br />
                コースから学習を始めましょう。
              </p>
              <Link
                href="/courses"
                className="inline-block mt-4 bg-[#00897b] text-white rounded-xl px-5 py-2.5 text-[12px] font-bold hover:bg-[#00695c] transition-colors"
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
                    className="block bg-white border border-[#e8ebe9] rounded-2xl px-4 py-3.5 hover:border-[#00897b] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#00897b] text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-zinc-500 truncate mb-0.5">
                          {e.courseTitle} ・ {e.chapterTitle}
                        </div>
                        <div className="text-[13px] font-bold text-zinc-900 leading-snug">
                          {e.lessonTitle}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-1">
                          {new Date(e.completedDate).toLocaleDateString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </div>
                      </div>
                      <span className="text-zinc-400 text-sm flex-shrink-0">
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
