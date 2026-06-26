"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CourseForm } from "./CourseForm";
import { deleteCourse } from "./actions";

export type CourseRowData = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  chapter_count: number;
};

export function CourseRow({ course }: { course: CourseRowData }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    const msg =
      course.chapter_count > 0
        ? `コース「${course.title}」を削除します。\n\n含まれる ${course.chapter_count} 個の章とすべてのレッスンも連動削除されます。\n\n本当によろしいですか?`
        : `コース「${course.title}」を削除します。よろしいですか?`;
    if (!window.confirm(msg)) return;

    startTransition(async () => {
      const result = await deleteCourse(course.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="rounded-[10px] border border-[#99f6e4] bg-[#f0fdfa] p-4">
        <p className="text-xs text-zinc-500 mb-2">編集中: {course.title}</p>
        <CourseForm
          mode={{
            kind: "edit",
            courseId: course.id,
            initial: {
              title: course.title,
              description: course.description,
              sort_order: course.sort_order,
              is_published: course.is_published,
            },
            onCancel: () => setEditing(false),
          }}
        />
      </li>
    );
  }

  return (
    <li className="rounded-[10px] border border-[#e8ebe9] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/courses/${course.id}`}
              className="font-semibold text-zinc-900 hover:text-[#00695c] hover:underline"
            >
              {course.title}
            </Link>
            <span className="text-xs text-zinc-400 font-mono">#{course.sort_order}</span>
            {course.is_published ? (
              <span className="text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                公開
              </span>
            ) : (
              <span className="text-[11px] font-bold rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 px-2 py-0.5">
                下書き
              </span>
            )}
            <span className="text-xs text-zinc-500">{course.chapter_count} 章</span>
          </div>
          {course.description && (
            <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
              {course.description}
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
