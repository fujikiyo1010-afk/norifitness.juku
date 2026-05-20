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
}: {
  courseId: string;
  chapters: AccordionChapter[];
  initialProgress: Record<string, boolean>;
}) {
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(new Set());
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
    // 楽観更新
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
        // ロールバック
        setProgress((prev) => ({ ...prev, [lessonId]: !nextState }));
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      {chapters.map((ch) => {
        const isOpen = openChapterIds.has(ch.id);
        const total = ch.lessons.length;
        const completed = ch.lessons.filter((l) => progress[l.id]).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isFullyDone = total > 0 && completed === total;

        return (
          <div
            key={ch.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
          >
            {/* 章ヘッダー(クリックで開閉) */}
            <button
              type="button"
              onClick={() => toggleChapter(ch.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-zinc-500 text-sm shrink-0 mt-0.5">
                {isOpen ? "▼" : "▶"}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {ch.title}
                  </h3>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {completed} / {total} 完了
                  </span>
                </div>
                {/* 進捗バー */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isFullyDone
                          ? "bg-emerald-500"
                          : "bg-zinc-900 dark:bg-zinc-300"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500 font-mono w-9 text-right">
                    {percent}%
                  </span>
                </div>
                {ch.description && !isOpen && (
                  <p className="text-xs text-zinc-500 line-clamp-1">
                    {ch.description}
                  </p>
                )}
              </div>
            </button>

            {/* 展開時のレッスン一覧 */}
            {isOpen && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                {ch.description && (
                  <div className="px-4 pt-3 pb-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {ch.description}
                  </div>
                )}
                {ch.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-500">
                    公開中のレッスンはありません。
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {ch.lessons.map((l) => {
                      const done = Boolean(progress[l.id]);
                      const isPending = pendingIds.has(l.id);
                      return (
                        <li
                          key={l.id}
                          className="px-4 py-3 flex items-center gap-3"
                        >
                          {/* 完了トグルボタン */}
                          <button
                            type="button"
                            onClick={() => toggleLesson(l.id)}
                            disabled={isPending}
                            aria-label={
                              done
                                ? "完了を取り消す"
                                : "このレッスンを完了にする"
                            }
                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors disabled:opacity-50 ${
                              done
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:border-zinc-500"
                            }`}
                          >
                            {isPending ? "…" : done ? "✓" : ""}
                          </button>

                          {/* レッスン情報 */}
                          <Link
                            href={`/courses/${courseId}/chapters/${ch.id}/lessons/${l.id}`}
                            className="min-w-0 flex-1 group"
                          >
                            <p
                              className={`text-sm font-medium group-hover:underline ${
                                done
                                  ? "text-zinc-500 dark:text-zinc-400"
                                  : "text-zinc-900 dark:text-zinc-50"
                              }`}
                            >
                              {l.title}
                            </p>
                            {l.meta_tags && l.meta_tags.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {l.meta_tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </Link>
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
