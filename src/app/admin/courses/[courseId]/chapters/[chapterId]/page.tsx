import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { LessonForm } from "./LessonForm";
import { LessonRow, type LessonRowData } from "./LessonRow";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string; chapterId: string }>;

export default async function ChapterDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const me = await requireAdmin();
  const { courseId, chapterId } = await params;

  const supabase = createAdminClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order, released_at")
    .eq("id", chapterId)
    .maybeSingle();

  if (!chapter || chapter.course_id !== courseId) {
    notFound();
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();

  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order, released_at"
    )
    .eq("chapter_id", chapterId)
    .order("sort_order", { ascending: true });

  const rows: LessonRowData[] = (lessons ?? []).map((l) => ({
    id: l.id,
    chapter_id: l.chapter_id,
    course_id: courseId,
    title: l.title,
    description: l.description,
    vimeo_url: l.vimeo_url,
    summary_video_url: l.summary_video_url,
    sub_image_url: l.sub_image_url,
    meta_tags: l.meta_tags as string[] | null,
    sort_order: l.sort_order,
    released_at: l.released_at,
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
              <Link
                href={`/admin/courses/${courseId}`}
                className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {course?.title ?? "(コース)"}
              </Link>
              <span>/</span>
              <span className="text-zinc-700 dark:text-zinc-300">{chapter.title}</span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              🎬 {chapter.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {me.name} さん ({me.role}) としてログイン中 / レッスン数: {rows.length}
            </p>
            {chapter.description && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {chapter.description}
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
            ➕ 新規レッスン追加
          </h2>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <LessonForm mode={{ kind: "create", courseId, chapterId }} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            📋 レッスン一覧 ({rows.length} 件)
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              まだレッスンがありません。上のフォームから追加してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
