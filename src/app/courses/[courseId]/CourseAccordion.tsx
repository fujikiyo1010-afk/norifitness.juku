"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setLessonProgress } from "@/lib/courses/progress-actions";

export type AccordionLesson = {
  id: string;
  title: string;
  meta_tags: string[] | null;
  sort_order: number;
};

export type AccordionChapter = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: AccordionLesson[];
};

export function CourseAccordion({
  courseId,
  chapters,
  initialProgress,
  currentLessonId = null,
}: {
  courseId: string;
  chapters: AccordionChapter[];
  initialProgress: Record<string, boolean>;
  currentLessonId?: string | null;
}) {
  // 「続きから」 が含まれる章を初期表示で開く ( モック L1011 = 進行中の章だけ開く)
  const initialOpen = (() => {
    if (!currentLessonId) return new Set<string>();
    const found = chapters.find((c) =>
      c.lessons.some((l) => l.id === currentLessonId),
    );
    return found ? new Set<string>([found.id]) : new Set<string>();
  })();

  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(initialOpen);
  const [progress, setProgress] = useState<Record<string, boolean>>(initialProgress);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggleChapter(chapterId: string) {
    setOpenChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  function toggleLesson(lessonId: string) {
    const nextState = !progress[lessonId];
    setError(null);
    setProgress((prev) => ({ ...prev, [lessonId]: nextState }));
    setPendingIds((prev) => new Set(prev).add(lessonId));

    startTransition(async () => {
      const result = await setLessonProgress(lessonId, nextState);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
      if (!result.ok) {
        setProgress((prev) => ({ ...prev, [lessonId]: !nextState }));
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {chapters.map((ch) => {
        const isOpen = openChapterIds.has(ch.id);
        const total = ch.lessons.length;
        const completed = ch.lessons.filter((l) => progress[l.id]).length;
        const isFullyDone = total > 0 && completed === total;
        const isInProgress = completed > 0 && !isFullyDone;
        const isNotStarted = completed === 0;

        return (
          <div
            key={ch.id}
            className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm"
          >
            {/* 章ヘッダー (タップで開閉) */}
            <button
              type="button"
              onClick={() => toggleChapter(ch.id)}
              className="w-full text-left px-4 py-3.5 grid grid-cols-[auto_1fr_auto] gap-2.5 items-center hover:bg-zinc-50 transition-colors"
            >
              {/* 章番号バッジ (完了=ティール緑塗り / 進行中=薄緑 / 未着手=淡) */}
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  isFullyDone
                    ? "bg-[#00897b] text-white"
                    : isInProgress
                      ? "bg-[#E0F2F1] text-[#004d40]"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {ch.sort_order}
              </span>
              <div className="min-w-0">
                <h3
                  className={`text-sm font-bold leading-snug ${
                    isNotStarted ? "text-zinc-500" : "text-zinc-900"
                  }`}
                >
                  {ch.title}
                </h3>
                <div
                  className={`text-[11px] mt-0.5 ${
                    isFullyDone
                      ? "text-[#00695c]"
                      : isInProgress
                        ? "text-[#004d40]"
                        : "text-zinc-400"
                  }`}
                >
                  {isFullyDone
                    ? `${completed} / ${total} 完了 ✓`
                    : isInProgress
                      ? `${completed} / ${total} ・ 進行中`
                      : `0 / ${total} ・ 未着手`}
                </div>
              </div>
              {/* 開閉アイコン */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            {/* 展開時のレッスン一覧 */}
            {isOpen && (
              <div className="border-t border-zinc-200 bg-zinc-50/50">
                {ch.description && (
                  <div className="px-4 pt-3 pb-1 text-xs text-zinc-600 whitespace-pre-wrap">
                    {ch.description}
                  </div>
                )}
                {ch.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-500">
                    公開中のレッスンはありません。
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200">
                    {ch.lessons.map((l) => {
                      const done = Boolean(progress[l.id]);
                      const isCurrent = l.id === currentLessonId && !done;
                      const isPending = pendingIds.has(l.id);
                      return (
                        <li
                          key={l.id}
                          className="px-4 py-3 grid grid-cols-[24px_1fr_auto] gap-2.5 items-center"
                        >
                          {/* ステータスアイコン (✓ / ▶ / ○) */}
                          <button
                            type="button"
                            onClick={() => toggleLesson(l.id)}
                            disabled={isPending}
                            aria-label={
                              done
                                ? "完了を取り消す"
                                : "このレッスンを完了にする"
                            }
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors disabled:opacity-50 ${
                              done
                                ? "bg-[#00897b] text-white hover:bg-[#00695c]"
                                : isCurrent
                                  ? "bg-amber-300 text-zinc-900 hover:bg-amber-400"
                                  : "bg-white border border-zinc-300 text-zinc-400 hover:border-zinc-500"
                            }`}
                          >
                            {isPending ? "…" : done ? "✓" : isCurrent ? "▶" : ""}
                          </button>

                          {/* レッスンタイトル */}
                          <div className="min-w-0">
                            <Link
                              href={`/courses/${courseId}/chapters/${ch.id}/lessons/${l.id}`}
                              className="group block"
                            >
                              <p
                                className={`text-xs leading-snug group-hover:underline ${
                                  isCurrent
                                    ? "text-[#004d40] font-bold"
                                    : done
                                      ? "text-zinc-500"
                                      : "text-zinc-700"
                                }`}
                              >
                                <span className="font-mono text-[10px] text-zinc-400 mr-1">
                                  L{l.sort_order}
                                </span>
                                {l.title}
                              </p>
                            </Link>
                            {l.meta_tags && l.meta_tags.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {l.meta_tags.map((tag) => (
                                  <Link
                                    key={tag}
                                    href={`/search?q=${encodeURIComponent(tag)}`}
                                    className="text-[10px] rounded bg-zinc-100 text-zinc-600 px-1.5 py-0.5 hover:bg-zinc-200"
                                  >
                                    {tag}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 「続きから」 黄バッジ */}
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-300 text-zinc-900 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                              続きから
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
