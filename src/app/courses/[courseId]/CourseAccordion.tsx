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

export type AccordionExamInfo = {
  examId: string;
  name: string;
  lastPassed: boolean | null;
  lastFinishedAt: string | null;
};

export function CourseAccordion({
  courseId,
  chapters,
  initialProgress,
  currentLessonId = null,
  examsByChapterId = {},
}: {
  courseId: string;
  chapters: AccordionChapter[];
  initialProgress: Record<string, boolean>;
  currentLessonId?: string | null;
  examsByChapterId?: Record<string, AccordionExamInfo>;
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
            className="rounded-lg border border-zinc-200 bg-[#fffdf8] overflow-hidden shadow-sm"
          >
            {/* 章ヘッダー (タップで開閉) */}
            <button
              type="button"
              onClick={() => toggleChapter(ch.id)}
              className="w-full text-left px-4 py-3.5 grid grid-cols-[auto_1fr_auto] gap-2.5 items-center hover:bg-[#f0e6d3] transition-colors"
            >
              {/* 章番号バッジ (完了=ティール緑塗り / 進行中=薄緑 / 未着手=淡) */}
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  isFullyDone
                    ? "bg-[#4a875b] text-white"
                    : isInProgress
                      ? "bg-[#E0F2F1] text-[#004d40]"
                      : "bg-zinc-100 text-[#a59b8c]"
                }`}
              >
                {ch.sort_order}
              </span>
              <div className="min-w-0">
                <h3
                  className={`text-sm font-bold leading-snug ${
                    isNotStarted ? "text-[#6a6256]" : "text-[#2b2620]"
                  }`}
                >
                  {ch.title}
                </h3>
                <div
                  className={`text-[11px] mt-0.5 ${
                    isFullyDone
                      ? "text-[#34603f]"
                      : isInProgress
                        ? "text-[#004d40]"
                        : "text-[#a59b8c]"
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
                className={`text-[#a59b8c] transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            {/* 展開時のレッスン一覧 */}
            {isOpen && (
              <div className="border-t border-zinc-200 bg-[#f9f5ed]/50">
                {ch.description && (
                  <div className="px-4 pt-3 pb-1 text-xs text-zinc-600 whitespace-pre-wrap">
                    {ch.description}
                  </div>
                )}
                {ch.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[#6a6256]">
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
                                ? "bg-[#4a875b] text-white hover:bg-[#34603f]"
                                : isCurrent
                                  ? "bg-amber-300 text-[#2b2620] hover:bg-amber-400"
                                  : "bg-[#fffdf8] border border-zinc-300 text-[#a59b8c] hover:border-zinc-500"
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
                                      ? "text-[#6a6256]"
                                      : "text-zinc-700"
                                }`}
                              >
                                <span className="font-mono text-[10px] text-[#a59b8c] mr-1">
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
                            <span className="text-[10px] bg-amber-300 text-[#2b2620] px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                              続きから
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {/* 章末 ・ テスト行 (exam がある章のみ表示) */}
                    {examsByChapterId[ch.id] ? (
                      <ExamRow
                        courseId={courseId}
                        chapterId={ch.id}
                        info={examsByChapterId[ch.id]}
                      />
                    ) : null}
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

function ExamRow({
  courseId,
  chapterId,
  info,
}: {
  courseId: string;
  chapterId: string;
  info: AccordionExamInfo;
}) {
  const passed = info.lastPassed === true;
  const attempted = info.lastPassed !== null;
  return (
    <li className="px-4 py-3 grid grid-cols-[24px_1fr_auto] gap-2.5 items-center bg-[#fffbeb]/40">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
          passed
            ? "bg-[#4a875b] text-white"
            : attempted
              ? "bg-amber-400 text-[#2b2620]"
              : "bg-[#fffdf8] border border-amber-300 text-amber-600"
        }`}
        aria-label={passed ? "テスト合格" : attempted ? "テスト挑戦中" : "テスト未受験"}
      >
        {passed ? "✓" : attempted ? "▶" : ""}
      </span>
      <div className="min-w-0">
        <Link
          href={`/courses/${courseId}/chapters/${chapterId}/exam`}
          className="group block"
        >
          <p className="text-xs leading-snug text-[#2b2620] font-bold group-hover:underline flex items-center gap-1.5">
            <span aria-hidden>📋</span>
            <span>テスト ・ {info.name}</span>
          </p>
        </Link>
        {attempted ? (
          <div className="mt-0.5 text-[10px] text-[#6a6256]">
            {passed ? "合格済 ・ 再挑戦可" : "再挑戦してみよう"}
          </div>
        ) : null}
      </div>
      <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
        テスト
      </span>
    </li>
  );
}
