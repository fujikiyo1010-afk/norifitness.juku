import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicCourse,
  getPublicChapter,
  getPublicLesson,
  getMyLessonProgress,
  getMyLessonReview,
  getAdjacentLessons,
} from "@/lib/courses/queries";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import {
  TextLessonRenderer,
  type TextLessonContent,
} from "@/components/TextLessonRenderer";
import { MemberHeader } from "@/components/MemberHeader";
import { CompleteButton } from "./CompleteButton";
import { ReviewAccordion } from "./ReviewAccordion";
import { PracticeInput } from "./PracticeInput";
import { listMyActionsForLesson } from "@/lib/practice/queries";
import { isBetaUser } from "@/lib/auth/beta";

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
  searchParams: Promise<{ from?: string; focus?: string }>;
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

  const [progressMap, review, adjacent, practiceActions, isBeta] =
    await Promise.all([
      getMyLessonProgress([lesson.id]),
      getMyLessonReview(lesson.id),
      getAdjacentLessons(courseId, lesson.id),
      listMyActionsForLesson(lesson.id),
      isBetaUser(),
    ]);

  // B10: 動画未設定・試験準備中でも受講生を止めない(ベータ限定)。次レッスンへの逃げ道URL。
  const nextLessonHref = adjacent.next
    ? `/courses/${courseId}/chapters/${adjacent.next.chapter_id}/lessons/${adjacent.next.lesson_id}`
    : null;
  const isCompleted = progressMap.get(lesson.id) === true;

  // 【テスト】 レッスン判定 ・ vimeo なし + meta_tags に「テスト」 含む
  // 試験機能 UI 実装まで「準備中」 表示で仮置き (線① ローンチ前にフル実装に置換)
  const isExam =
    (lesson.meta_tags?.includes("テスト") ?? false) && !lesson.vimeo_url;

  // 配布資料 統合 (description + sub_image_url + summary_video_url)
  const hasAttachment = !!(
    lesson.description ||
    lesson.sub_image_url ||
    lesson.summary_video_url
  );

  return (
    <>
      <MemberHeader
        title="レッスン"
        fallbackHref={`/courses/${courseId}`}
        rightIcon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        }
      />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="space-y-2">
          {/* レッスンタイトル + 章名 (パンくずは AppHeader 戻る矢印で代替) */}
          <div className="text-[11px] text-[#6a6256]">
            <Link
              href={`/courses/${courseId}`}
              className="hover:text-zinc-700 font-bold"
            >
              {chapter.title}
            </Link>
            <span className="mx-1">&gt;</span>
            <span className="text-zinc-700">L{lesson.sort_order}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#2b2620] leading-tight">
            {lesson.title}
          </h1>
          {lesson.meta_tags && lesson.meta_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lesson.meta_tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="text-[10px] rounded bg-zinc-100 text-zinc-700 px-1.5 py-0.5 hover:bg-zinc-200"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* 動画 or テキストレッスン or 試験準備中 or 動画URLなし */}
        {isExam ? (
          <section className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
            <div className="text-sm font-bold text-amber-800 mb-1">
              理解度テスト ・ 準備中
            </div>
            <div className="text-xs text-amber-700 leading-relaxed">
              この章の理解度テストは近日中に実装予定です。
              <br />
              先に動画レッスンを視聴して内容を学んでください。
            </div>
            {isBeta && nextLessonHref && (
              <Link
                href={nextLessonHref}
                className="mt-3 inline-block rounded-full bg-[#4a875b] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#34603f]"
              >
                次のレッスンへ →
              </Link>
            )}
          </section>
        ) : lesson.vimeo_url ? (
          <VimeoEmbed url={lesson.vimeo_url} />
        ) : lesson.content_json ? (
          <TextLessonRenderer
            content={lesson.content_json as TextLessonContent}
          />
        ) : (
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-6 text-center text-sm text-[#6a6256]">
            {isBeta ? (
              <>
                <div className="font-bold text-[#2b2620]">準備中です</div>
                <div className="mt-1 text-[12px] leading-relaxed">
                  このレッスンの動画はまだ準備中です。先に進んで大丈夫です。
                </div>
                {nextLessonHref && (
                  <Link
                    href={nextLessonHref}
                    className="mt-3 inline-block rounded-full bg-[#4a875b] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#34603f]"
                  >
                    次のレッスンへ →
                  </Link>
                )}
              </>
            ) : (
              "動画 URL が設定されていません。"
            )}
          </div>
        )}

        {/* 完了ボタン (試験は対象外。ただしベータは試験準備中でも完了可=進行を止めない B10) */}
        {(!isExam || isBeta) && (
          <section>
            <CompleteButton
              lessonId={lesson.id}
              initialCompleted={isCompleted}
            />
          </section>
        )}

        {/* 3 行振り返り (試験は対象外) */}
        {!isExam && (
          <section>
            <ReviewAccordion lessonId={lesson.id} initial={review} />
          </section>
        )}

        {/* 実践リスト 「今週これを試す」 (試験は対象外) */}
        {!isExam && (
          <section>
            <PracticeInput
              lessonId={lesson.id}
              existingCount={practiceActions.length}
            />
          </section>
        )}

        {/* 配布資料 (description + sub_image_url + summary_video_url 統合) */}
        {!isExam && hasAttachment && (
          <details className="rounded-xl bg-[#fffdf8] border border-zinc-200 p-3 group">
            <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-[#2b2620] list-none">
              <span className="inline-flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                配布資料
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-open:rotate-180 transition-transform"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-3 space-y-3 text-sm text-zinc-700">
              {lesson.description && (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {lesson.description}
                </div>
              )}
              {lesson.sub_image_url && (
                <div>
                  <a
                    href={lesson.sub_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#34603f] underline break-all"
                  >
                    補助画像を開く ↗
                  </a>
                </div>
              )}
              {lesson.summary_video_url && (
                <div>
                  <a
                    href={lesson.summary_video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#34603f] underline break-all"
                  >
                    全まとめ動画を開く ↗
                  </a>
                </div>
              )}
            </div>
          </details>
        )}

        {/* 次のレッスン (モック準拠 薄緑カード) ・ コース末は完了画面ふう */}
        <section className="space-y-2 pt-2">
          {adjacent.next ? (
            <Link
              href={`/courses/${courseId}/chapters/${adjacent.next.chapter_id}/lessons/${adjacent.next.lesson_id}`}
              className="flex items-center justify-between bg-[#f0f9f8] border border-[#4a875b] rounded-xl px-4 py-3.5 hover:bg-[#e0f2f1] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[10px] text-[#6a6256] mb-0.5">
                  次のレッスン →
                </div>
                <div className="text-sm font-bold text-[#34603f] truncate">
                  {adjacent.next.lesson_title}
                </div>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34603f"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 ml-2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border border-[#4a875b]/30 p-5 text-center">
              <div className="text-base font-bold text-[#004d40] mb-1">
                コースを完走しました ✓
              </div>
              <div className="text-xs text-zinc-600 mb-3">
                おつかれさまでした ・ 別のコースも視聴してみましょう。
              </div>
              <Link
                href="/courses"
                className="inline-block rounded-md bg-[#4a875b] hover:bg-[#34603f] text-white px-4 py-2 text-xs font-bold transition-colors"
              >
                コース一覧へ
              </Link>
            </div>
          )}
          {adjacent.prev && (
            <Link
              href={`/courses/${courseId}/chapters/${adjacent.prev.chapter_id}/lessons/${adjacent.prev.lesson_id}`}
              className="flex items-center gap-1 text-xs text-[#6a6256] hover:text-zinc-700 px-1 py-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              前のレッスン:&nbsp;
              <span className="truncate max-w-[200px]">
                {adjacent.prev.lesson_title}
              </span>
            </Link>
          )}
        </section>

        {/* 章/コースに戻る (補助動線) */}
        <div className="pt-3 border-t border-zinc-200">
          <Link
            href={`/courses/${courseId}`}
            className="text-xs text-[#6a6256] underline hover:text-zinc-700"
          >
            ← {course.title} の章一覧へ
          </Link>
        </div>
        </div>
      </main>
    </>
  );
}
