import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { ChapterForm } from "./ChapterForm";
import { ChapterRow, type ChapterRowData } from "./ChapterRow";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ courseId: string }>;

export default async function CourseDetailPage({
  params,
}: {
  params: SearchParams;
}) {
  const me = await requireAdmin();
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
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <nav className="text-xs text-zinc-500 space-x-1">
              <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                ホーム
              </Link>
              <span>/</span>
              <Link
                href="/admin/courses"
                className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                コース管理
              </Link>
              <span>/</span>
              <span className="text-zinc-700 dark:text-zinc-300">{course.title}</span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              📖 {course.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {me.name} さん ({me.role}) としてログイン中 / 章数: {rows.length}
            </p>
            {course.description && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {course.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs font-medium"
              >
                ログアウト
              </button>
            </form>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ➕ 新規章追加
          </h2>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <ChapterForm mode={{ kind: "create", courseId }} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            📋 章一覧 ({rows.length} 件)
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              まだ章がありません。上のフォームから追加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => (
                <ChapterRow key={c.id} chapter={c} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
