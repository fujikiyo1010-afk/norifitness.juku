import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { CourseForm } from "./CourseForm";
import { CourseRow, type CourseRowData } from "./CourseRow";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const me = await requireAdmin();

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
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">管理画面</p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              📚 コース管理
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {me.name} さん ({me.role}) としてログイン中
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 underline">
              ← ホームへ
            </Link>
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
            ➕ 新規コース追加
          </h2>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <CourseForm mode={{ kind: "create" }} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            📋 コース一覧 ({rows.length} 件)
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              まだコースがありません。上のフォームから追加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => (
                <CourseRow key={c.id} course={c} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
