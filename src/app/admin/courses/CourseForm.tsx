"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourse, updateCourse } from "./actions";

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      courseId: string;
      initial: {
        title: string;
        description: string | null;
        sort_order: number;
        is_published: boolean;
      };
      onCancel: () => void;
    };

export function CourseForm({ mode }: { mode: Mode }) {
  const initial =
    mode.kind === "create"
      ? { title: "", description: "", sort_order: 100, is_published: true }
      : {
          title: mode.initial.title,
          description: mode.initial.description ?? "",
          sort_order: mode.initial.sort_order,
          is_published: mode.initial.is_published,
        };

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [sortOrder, setSortOrder] = useState(initial.sort_order);
  const [isPublished, setIsPublished] = useState(initial.is_published);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      title,
      description,
      sort_order: Number(sortOrder),
      is_published: isPublished,
    };

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createCourse(payload)
          : await updateCourse(mode.courseId, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (mode.kind === "create") {
        setTitle("");
        setDescription("");
        setSortOrder(initial.sort_order + 10);
        setIsPublished(true);
      } else {
        mode.onCancel();
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            タイトル
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            placeholder="限定ボディメイク完全ロードマップ動画"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            表示順
          </label>
          <input
            type="number"
            required
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            disabled={pending}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          説明（任意）
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          disabled={pending}
        />
        公開する（受講生に表示）
      </label>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-2 text-xs text-red-800 dark:text-red-100">
          ❌ {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || title.trim().length === 0}
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending
            ? "保存中…"
            : mode.kind === "create"
              ? "コースを追加"
              : "保存"}
        </button>
        {mode.kind === "edit" && (
          <button
            type="button"
            onClick={mode.onCancel}
            disabled={pending}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
