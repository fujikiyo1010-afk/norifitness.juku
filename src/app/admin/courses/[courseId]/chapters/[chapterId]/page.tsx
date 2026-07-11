import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonForm } from "./LessonForm";
import { LessonRow, type LessonRowData } from "./LessonRow";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ courseId: string; chapterId: string }>;

export default async function ChapterDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  await requireAdmin();
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

  // S2: course と lessons は互いに独立→並列(chapterのガード後に実行=挙動不変)。
  const [{ data: course }, { data: lessons }] = await Promise.all([
    supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
    supabase
      .from("lessons")
      .select(
        "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order, released_at"
      )
      .eq("chapter_id", chapterId)
      .order("sort_order", { ascending: true }),
  ]);

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
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <nav className="text-xs text-zinc-500 space-x-1.5">
          <Link href="/admin/courses" className="hover:text-zinc-700 underline">
            コース管理
          </Link>
          <span>/</span>
          <Link
            href={`/admin/courses/${courseId}`}
            className="hover:text-zinc-700 underline"
          >
            {course?.title ?? "(コース)"}
          </Link>
          <span>/</span>
          <span className="text-zinc-700">{chapter.title}</span>
        </nav>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">{chapter.title}</h1>
        {chapter.description && (
          <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
            {chapter.description}
          </p>
        )}
      </header>

      {/* 新規レッスン追加 */}
      <section className="bg-gradient-to-br from-white to-[#e0f2f1]/30 border border-[#b2dfdb] rounded-[12px] p-5 mb-7">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00897b]" />
          新規レッスン追加
        </h2>
        <LessonForm mode={{ kind: "create", courseId, chapterId }} />
      </section>

      {/* レッスン一覧 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-zinc-900">レッスン一覧</h2>
          <span className="text-[11px] text-zinc-500 font-mono">全 {rows.length} 件</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
            まだレッスンがありません。上のフォームから追加してください。
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((l) => (
              <LessonRow key={l.id} lesson={l} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
