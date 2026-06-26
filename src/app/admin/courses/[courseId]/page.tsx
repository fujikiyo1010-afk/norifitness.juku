import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChapterForm } from "./ChapterForm";
import { ChapterRow, type ChapterRowData } from "./ChapterRow";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ courseId: string }>;

export default async function CourseDetailPage({
  params,
}: {
  params: SearchParams;
}) {
  await requireAdmin();
  const { courseId } = await params;

  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, sort_order, is_published")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    notFound();
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order, released_at")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  // レッスン数を取得
  const chapterIds = (chapters ?? []).map((c) => c.id);
  const lessonCounts = new Map<string, number>();
  if (chapterIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("chapter_id")
      .in("chapter_id", chapterIds);
    (lessons ?? []).forEach((l) => {
      lessonCounts.set(l.chapter_id, (lessonCounts.get(l.chapter_id) ?? 0) + 1);
    });
  }

  const rows: ChapterRowData[] = (chapters ?? []).map((c) => ({
    id: c.id,
    course_id: c.course_id,
    title: c.title,
    description: c.description,
    sort_order: c.sort_order,
    released_at: c.released_at,
    lesson_count: lessonCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <nav className="text-xs text-zinc-500 space-x-1.5">
          <Link href="/admin/courses" className="hover:text-zinc-700 underline">
            コース管理
          </Link>
          <span>/</span>
          <span className="text-zinc-700">{course.title}</span>
        </nav>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">{course.title}</h1>
        {course.description && (
          <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
            {course.description}
          </p>
        )}
      </header>

      {/* 新規章追加 */}
      <section className="bg-gradient-to-br from-white to-[#e0f2f1]/30 border border-[#b2dfdb] rounded-[12px] p-5 mb-7">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00897b]" />
          新規章追加
        </h2>
        <ChapterForm mode={{ kind: "create", courseId }} />
      </section>

      {/* 章一覧 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-zinc-900">章一覧</h2>
          <span className="text-[11px] text-zinc-500 font-mono">全 {rows.length} 件</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
            まだ章がありません。上のフォームから追加してください。
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <ChapterRow key={c.id} chapter={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
