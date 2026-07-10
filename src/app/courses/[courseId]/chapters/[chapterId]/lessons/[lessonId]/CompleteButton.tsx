"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLessonProgress } from "@/lib/courses/progress-actions";

export function CompleteButton({
  lessonId,
  initialCompleted,
  isBeta = false,
  recordedBodyToday = false,
}: {
  lessonId: string;
  initialCompleted: boolean;
  /** C19 完了トースト(ベータ) の出し分け */
  isBeta?: boolean;
  /** 今日すでに体組成を記録済みか(トーストの「今日の達成 x/2」計算用) */
  recordedBodyToday?: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
      // C19: 完了時に「今日の達成 x/2」トースト(ベータ)。v1= 学習+体組成の2つ。
      if (next && isBeta) {
        const done = 1 + (recordedBodyToday ? 1 : 0);
        setToast(`レッスン完了！今日の達成 ${done}/2`);
        window.setTimeout(() => setToast(null), 2600);
      }
      router.refresh();
    });
  }

  const toastEl = toast ? (
    <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2.5 rounded-xl bg-[#2b2620] px-4 py-3 text-white shadow-[0_8px_22px_rgba(0,0,0,0.25)]">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#2f9e5a] text-[11px]">
          ✓
        </span>
        <span className="text-[12.5px] font-bold">{toast}</span>
      </div>
    </div>
  ) : null;

  if (completed) {
    return (
      <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4 space-y-3">
        {toastEl}
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
      {toastEl}
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 dark:bg-[#f9f5ed] px-6 py-4 text-base font-semibold text-white dark:text-[#2b2620] disabled:opacity-50 transition-transform active:scale-[0.98]"
      >
        {pending ? "保存中…" : "✓ 学習完了にする"}
      </button>
      {error && (
        <p className="text-xs text-red-700 dark:text-red-300">❌ {error}</p>
      )}
    </div>
  );
}
