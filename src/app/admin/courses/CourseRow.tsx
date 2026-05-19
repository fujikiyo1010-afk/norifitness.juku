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
      <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
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
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/courses/${course.id}`}
              className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
            >
              {course.title}
            </Link>
            <span className="text-xs text-zinc-500">#{course.sort_order}</span>
            {course.is_published ? (
              <span className="text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 px-2 py-0.5">
                公開
              </span>
            ) : (
              <span className="text-xs rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5">
                下書き
              </span>
            )}
            <span className="text-xs text-zinc-500">{course.chapter_count} 章</span>
          </div>
          {course.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {course.description}
            </p>
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
      {error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">❌ {error}</p>
      )}
    </li>
  );
}
