"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLesson, updateLesson } from "./actions";

type LessonInitial = {
  title: string;
  description: string | null;
  vimeo_url: string | null;
  summary_video_url: string | null;
  sub_image_url: string | null;
  meta_tags: string[] | null;
  sort_order: number;
  released_at: string | null;
};

type Mode =
  | { kind: "create"; courseId: string; chapterId: string }
  | {
      kind: "edit";
      courseId: string;
      chapterId: string;
      lessonId: string;
      initial: LessonInitial;
      onCancel: () => void;
    };

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function LessonForm({ mode }: { mode: Mode }) {
  const initial =
    mode.kind === "create"
      ? {
          title: "",
          description: "",
          vimeo_url: "",
          summary_video_url: "",
          sub_image_url: "",
          meta_tags_csv: "",
          sort_order: 10,
          released_at: "",
        }
      : {
          title: mode.initial.title,
          description: mode.initial.description ?? "",
          vimeo_url: mode.initial.vimeo_url ?? "",
          summary_video_url: mode.initial.summary_video_url ?? "",
          sub_image_url: mode.initial.sub_image_url ?? "",
          meta_tags_csv: (mode.initial.meta_tags ?? []).join(", "),
          sort_order: mode.initial.sort_order,
          released_at: isoToLocal(mode.initial.released_at),
        };

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [vimeoUrl, setVimeoUrl] = useState(initial.vimeo_url);
  const [summaryVideoUrl, setSummaryVideoUrl] = useState(initial.summary_video_url);
  const [subImageUrl, setSubImageUrl] = useState(initial.sub_image_url);
  const [metaTagsCsv, setMetaTagsCsv] = useState(initial.meta_tags_csv);
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
      vimeo_url: vimeoUrl,
      summary_video_url: summaryVideoUrl,
      sub_image_url: subImageUrl,
      meta_tags_csv: metaTagsCsv,
      sort_order: Number(sortOrder),
      released_at: localToIso(releasedAt),
    };

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createLesson(mode.courseId, mode.chapterId, payload)
          : await updateLesson(mode.courseId, mode.chapterId, mode.lessonId, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (mode.kind === "create") {
        setTitle("");
        setDescription("");
        setVimeoUrl("");
        setSummaryVideoUrl("");
        setSubImageUrl("");
        setMetaTagsCsv("");
        setSortOrder(initial.sort_order + 10);
        setReleasedAt("");
      } else {
        mode.onCancel();
      }
      router.refresh();
    });
  }

  const fieldClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50";
  const labelClass = "block text-xs font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
        <div className="space-y-1">
          <label className={labelClass}>タイトル</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            placeholder="ベンチプレス"
            className={fieldClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>表示順</label>
          <input
            type="number"
            required
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            disabled={pending}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>説明（任意）</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Vimeo URL（メイン動画）</label>
        <input
          type="url"
          value={vimeoUrl}
          onChange={(e) => setVimeoUrl(e.target.value)}
          disabled={pending}
          placeholder="https://vimeo.com/123456789"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>全まとめ動画 URL（任意）</label>
        <input
          type="url"
          value={summaryVideoUrl}
          onChange={(e) => setSummaryVideoUrl(e.target.value)}
          disabled={pending}
          placeholder="https://vimeo.com/..."
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>補助画像 URL（任意・解剖図など）</label>
        <input
          type="url"
          value={subImageUrl}
          onChange={(e) => setSubImageUrl(e.target.value)}
          disabled={pending}
          placeholder="https://..."
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>
          部位タグ（カンマ区切り、例: 胸, 自重, 初心者）
        </label>
        <input
          type="text"
          value={metaTagsCsv}
          onChange={(e) => setMetaTagsCsv(e.target.value)}
          disabled={pending}
          placeholder="胸, 自重"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass}>
          公開日時（空欄で即公開、入力でその日時から段階公開）
        </label>
        <input
          type="datetime-local"
          value={releasedAt}
          onChange={(e) => setReleasedAt(e.target.value)}
          disabled={pending}
          className={fieldClass}
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
          {pending ? "保存中…" : mode.kind === "create" ? "レッスンを追加" : "保存"}
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
