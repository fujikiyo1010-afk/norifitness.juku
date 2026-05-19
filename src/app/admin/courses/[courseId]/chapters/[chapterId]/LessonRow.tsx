"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LessonForm } from "./LessonForm";
import { deleteLesson } from "./actions";

export type LessonRowData = {
  id: string;
  chapter_id: string;
  course_id: string; // 親の course_id を持ち回り
  title: string;
  description: string | null;
  vimeo_url: string | null;
  summary_video_url: string | null;
  sub_image_url: string | null;
  meta_tags: string[] | null;
  sort_order: number;
  released_at: string | null;
};

function formatJst(iso: string | null): string {
  if (!iso) return "即公開";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function isReleased(iso: string | null): boolean {
  if (!iso) return true;
  return new Date(iso).getTime() <= Date.now();
}

export function LessonRow({ lesson }: { lesson: LessonRowData }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    if (!window.confirm(`レッスン「${lesson.title}」を削除します。よろしいですか?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteLesson(lesson.course_id, lesson.chapter_id, lesson.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
        <p className="text-xs text-zinc-500 mb-2">編集中: {lesson.title}</p>
        <LessonForm
          mode={{
            kind: "edit",
            courseId: lesson.course_id,
            chapterId: lesson.chapter_id,
            lessonId: lesson.id,
            initial: {
              title: lesson.title,
              description: lesson.description,
              vimeo_url: lesson.vimeo_url,
              summary_video_url: lesson.summary_video_url,
              sub_image_url: lesson.sub_image_url,
              meta_tags: lesson.meta_tags,
              sort_order: lesson.sort_order,
              released_at: lesson.released_at,
            },
            onCancel: () => setEditing(false),
          }}
        />
      </li>
    );
  }

  const released = isReleased(lesson.released_at);

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {lesson.title}
            </span>
            <span className="text-xs text-zinc-500">#{lesson.sort_order}</span>
            {released ? (
              <span className="text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 px-2 py-0.5">
                公開中
              </span>
            ) : (
              <span className="text-xs rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 px-2 py-0.5">
                予約: {formatJst(lesson.released_at)}
              </span>
            )}
            {!lesson.vimeo_url && (
              <span className="text-xs rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5">
                動画未設定
              </span>
            )}
          </div>
          {lesson.meta_tags && lesson.meta_tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {lesson.meta_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {lesson.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-2">
              {lesson.description}
            </p>
          )}
          {lesson.vimeo_url && (
            <p className="mt-1 text-xs text-zinc-500 truncate">🎥 {lesson.vimeo_url}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
          >
            編集
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-950 px-2 py-1 text-xs text-red-700 dark:text-red-300 disabled:opacity-50"
          >
            {pending ? "..." : "削除"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700 dark:text-red-300">❌ {error}</p>}
    </li>
  );
}
