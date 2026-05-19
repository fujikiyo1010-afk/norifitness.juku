"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChapter, updateChapter } from "./actions";

type Mode =
  | { kind: "create"; courseId: string }
  | {
      kind: "edit";
      courseId: string;
      chapterId: string;
      initial: {
        title: string;
        description: string | null;
        sort_order: number;
        released_at: string | null;
      };
      onCancel: () => void;
    };

// ISO 文字列 → datetime-local 入力用 (YYYY-MM-DDTHH:mm)
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // ローカルタイムゾーンで表示
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function ChapterForm({ mode }: { mode: Mode }) {
  const initial =
    mode.kind === "create"
      ? { title: "", description: "", sort_order: 10, released_at: "" }
      : {
          title: mode.initial.title,
          description: mode.initial.description ?? "",
          sort_order: mode.initial.sort_order,
          released_at: isoToLocal(mode.initial.released_at),
        };

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [sortOrder, setSortOrder] = useState(initial.sort_order);
  const [releasedAt, setReleasedAt] = useState(initial.released_at);
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
      released_at: localToIso(releasedAt),
    };

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createChapter(mode.courseId, payload)
          : await updateChapter(mode.courseId, mode.chapterId, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (mode.kind === "create") {
        setTitle("");
        setDescription("");
        setSortOrder(initial.sort_order + 10);
        setReleasedAt("");
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
            placeholder="0. はじめに必ず視聴して下さい"
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

      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          公開日時（空欄で即公開、入力でその日時から段階公開）
        </label>
        <input
          type="datetime-local"
          value={releasedAt}
          onChange={(e) => setReleasedAt(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>

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
          {pending ? "保存中…" : mode.kind === "create" ? "章を追加" : "保存"}
        </button>
        {mode.kind === "edit" && (
          <button
            type="button"
            onClick={mode.onCancel}
            disabled={pending}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2 text-xs"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
