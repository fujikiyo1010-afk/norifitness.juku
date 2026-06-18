"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLessonProgress } from "@/lib/courses/progress-actions";

export function CompleteButton({
  lessonId,
  initialCompleted,
}: {
  lessonId: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    const next = !completed;
    setError(null);
    // 楽観更新
    setCompleted(next);

    startTransition(async () => {
      const result = await setLessonProgress(lessonId, next);
      if (!result.ok) {
        // 失敗 → ロールバック
        setCompleted(!next);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (completed) {
    return (
      <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4 space-y-3">
        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold">学習完了</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              お疲れ様でした
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className="text-xs text-emerald-700 dark:text-emerald-300 underline disabled:opacity-50"
        >
          {pending ? "更新中…" : "未完了に戻す"}
        </button>
        {error && (
          <p className="text-xs text-red-700 dark:text-red-300">❌ {error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 dark:bg-[#ebdfc6] px-6 py-4 text-base font-semibold text-white dark:text-[#2b2620] disabled:opacity-50 transition-transform active:scale-[0.98]"
      >
        {pending ? "保存中…" : "✓ 学習完了にする"}
      </button>
      {error && (
        <p className="text-xs text-red-700 dark:text-red-300">❌ {error}</p>
      )}
    </div>
  );
}
