"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChapterForm } from "./ChapterForm";
import { deleteChapter } from "./actions";

export type ChapterRowData = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  released_at: string | null;
  lesson_count: number;
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

export function ChapterRow({ chapter }: { chapter: ChapterRowData }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    const msg =
      chapter.lesson_count > 0
        ? `章「${chapter.title}」を削除します。\n\n含まれる ${chapter.lesson_count} 個のレッスンも連動削除されます。\n\n本当によろしいですか?`
        : `章「${chapter.title}」を削除します。よろしいですか?`;
    if (!window.confirm(msg)) return;

    startTransition(async () => {
      const result = await deleteChapter(chapter.course_id, chapter.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-[10px] border border-[#99f6e4] bg-[#f0fdfa] p-4">
        <p className="text-xs text-zinc-500 mb-2">編集中: {chapter.title}</p>
        <ChapterForm
          mode={{
            kind: "edit",
            courseId: chapter.course_id,
            chapterId: chapter.id,
            initial: {
              title: chapter.title,
              description: chapter.description,
              sort_order: chapter.sort_order,
              released_at: chapter.released_at,
            },
            onCancel: () => setEditing(false),
          }}
        />
      </li>
    );
  }

  const released = isReleased(chapter.released_at);

  return (
    <li className="rounded-[10px] border border-[#e8ebe9] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/courses/${chapter.course_id}/chapters/${chapter.id}`}
              className="font-semibold text-zinc-900 hover:text-[#00695c] hover:underline"
            >
              {chapter.title}
            </Link>
            <span className="text-xs text-zinc-400 font-mono">#{chapter.sort_order}</span>
            {released ? (
              <span className="text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                公開中
              </span>
            ) : (
              <span className="text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
                予約: {formatJst(chapter.released_at)}
              </span>
            )}
            <span className="text-xs text-zinc-500">{chapter.lesson_count} レッスン</span>
          </div>
          {chapter.description && (
            <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
              {chapter.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
          >
            編集
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {pending ? "..." : "削除"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  );
}
