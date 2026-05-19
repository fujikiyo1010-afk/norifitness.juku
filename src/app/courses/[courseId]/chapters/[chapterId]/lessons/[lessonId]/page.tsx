import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  getPublicChapter,
  getPublicLesson,
} from "@/lib/courses/queries";
import { VimeoEmbed } from "@/components/VimeoEmbed";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{
  courseId: string;
  chapterId: string;
  lessonId: string;
}>;

export default async function StudentLessonPage({
  params,
}: {
  params: RouteParams;
}) {
  const { courseId, chapterId, lessonId } = await params;

  const [course, chapter, lesson] = await Promise.all([
    getPublicCourse(courseId),
    getPublicChapter(courseId, chapterId),
    getPublicLesson(chapterId, lessonId),
  ]);
  if (!course || !chapter || !lesson) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <nav className="text-xs text-zinc-500 space-x-1">
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              ホーム
            </Link>
            <span>/</span>
            <Link href="/courses" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              コース一覧
            </Link>
            <span>/</span>
            <Link
              href={`/courses/${courseId}`}
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {course.title}
            </Link>
            <span>/</span>
            <Link
              href={`/courses/${courseId}/chapters/${chapterId}`}
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {chapter.title}
            </Link>
            <span>/</span>
            <span className="text-zinc-700 dark:text-zinc-300">{lesson.title}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {lesson.title}
          </h1>
          {lesson.meta_tags && lesson.meta_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lesson.meta_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 動画 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            🎥 動画
          </h2>
          {lesson.vimeo_url ? (
            <VimeoEmbed url={lesson.vimeo_url} />
          ) : (
            <p className="text-sm text-zinc-500">動画 URL が設定されていません。</p>
          )}
        </section>

        {/* 説明 */}
        {lesson.description && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              📝 説明
            </h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {lesson.description}
            </p>
          </section>
        )}

        {/* 補助画像 */}
        {lesson.sub_image_url && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              🖼 補助画像
            </h2>
            <a
              href={lesson.sub_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-900 dark:text-zinc-50 underline break-all"
            >
              {lesson.sub_image_url} ↗
            </a>
          </section>
        )}

        {/* 全まとめ動画 */}
        {lesson.summary_video_url && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              📼 全まとめ動画
            </h2>
            <a
              href={lesson.summary_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-900 dark:text-zinc-50 underline break-all"
            >
              {lesson.summary_video_url} ↗
            </a>
          </section>
        )}

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href={`/courses/${courseId}/chapters/${chapterId}`}
            className="text-sm text-zinc-600 dark:text-zinc-400 underline"
          >
            ← {chapter.title} に戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
