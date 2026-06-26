import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CourseForm } from "./CourseForm";
import { CourseRow, type CourseRowData } from "./CourseRow";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, sort_order, is_published")
    .order("sort_order", { ascending: true });

  // 章数を別クエリで取得(コース ID ごとの集計)
  const courseIds = (courses ?? []).map((c) => c.id);
  const chapterCounts = new Map<string, number>();
  if (courseIds.length > 0) {
    const { data: chapters } = await supabase
      .from("chapters")
      .select("course_id")
      .in("course_id", courseIds);
    (chapters ?? []).forEach((ch) => {
      chapterCounts.set(ch.course_id, (chapterCounts.get(ch.course_id) ?? 0) + 1);
    });
  }

  const rows: CourseRowData[] = (courses ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    sort_order: c.sort_order,
    is_published: c.is_published,
    chapter_count: chapterCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">コース管理</h1>
        <p className="text-xs text-zinc-500 mt-1">
          コース ・ 章 ・ レッスンの追加 / 編集 / 削除ができます
        </p>
      </header>

      {/* 新規コース追加 */}
      <section className="bg-gradient-to-br from-white to-[#e0f2f1]/30 border border-[#b2dfdb] rounded-[12px] p-5 mb-7">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00897b]" />
          新規コース追加
        </h2>
        <CourseForm mode={{ kind: "create" }} />
      </section>

      {/* 一覧 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-zinc-900">コース一覧</h2>
          <span className="text-[11px] text-zinc-500 font-mono">全 {rows.length} 件</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
            まだコースがありません。上のフォームから追加してください。
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <CourseRow key={c.id} course={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
