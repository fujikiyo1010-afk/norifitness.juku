"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveReview } from "@/lib/courses/review-actions";

type InitialReview = {
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
  updated_at: string;
} | null;

function formatJst(iso: string): string {
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

export function ReviewAccordion({
  lessonId,
  initial,
}: {
  lessonId: string;
  initial: InitialReview;
}) {
  const searchParams = useSearchParams();
  const focusReview = searchParams?.get("focus") === "review";
  const [isOpen, setIsOpen] = useState(focusReview);
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusReview && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // 初回マウントのみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [learned, setLearned] = useState(initial?.learned ?? "");
  const [impressed, setImpressed] = useState(initial?.impressed ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initial?.updated_at ?? null
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasReview = initial !== null;
  const hasChanges =
    learned !== (initial?.learned ?? "") ||
    impressed !== (initial?.impressed ?? "");
  const allEmpty =
    learned.trim() === "" &&
    impressed.trim() === "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (allEmpty) {
      setError("少なくとも 1 つは入力してください");
      return;
    }

    startTransition(async () => {
      const result = await saveReview(lessonId, {
        learned: learned.trim() || null,
        impressed: impressed.trim() || null,
        next_action: null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLastSavedAt(result.updated_at);
      setSuccess(hasReview ? "更新しました" : "保存しました");
      router.refresh();
      setTimeout(() => setSuccess(null), 3000);
    });
  }

  const textareaClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-[#fffdf8] dark:bg-zinc-950 px-3 py-2 text-sm text-[#2b2620] dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none disabled:opacity-50 resize-y";

  return (
    <div ref={sectionRef} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-[#fffdf8] dark:bg-zinc-900 overflow-hidden scroll-mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-[#e0d5be] dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-[#6a6256] text-sm shrink-0">
          {isOpen ? "▼" : "▶"}
        </span>
        <span className="text-base font-semibold text-[#2b2620] dark:text-zinc-50">
          📝 2 行で振り返り
        </span>
        <span className="text-xs text-[#6a6256]">(任意)</span>
        {hasReview && !isOpen && (
          <span className="ml-auto text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 px-2 py-0.5">
            記入済み
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <p className="text-xs text-[#6a6256]">
            今日の学びを自分の言葉で書いてみよう。書く行為で記憶が定着しやすくなります(Feynman 技法)。
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                1. 学んだこと
              </label>
              <textarea
                rows={2}
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                disabled={pending}
                placeholder="例: 肩甲骨を寄せることで胸に効きやすくなることがわかった"
                className={textareaClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                2. 印象に残ったこと
              </label>
              <textarea
                rows={2}
                value={impressed}
                onChange={(e) => setImpressed(e.target.value)}
                disabled={pending}
                placeholder="例: バーは胸ではなく肋骨に向かう、という考え方"
                className={textareaClass}
              />
            </div>
            <p className="text-[11px] text-[#6a6256] leading-relaxed">
              「次にやってみたいこと」 は ↓「今週これを試す」 (実践リスト) で宣言してください。
            </p>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-2 text-xs text-red-800 dark:text-red-100">
                ❌ {error}
              </div>
            )}
            {success && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-2 text-xs text-emerald-800 dark:text-emerald-100">
                ✅ {success}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={pending || !hasChanges || allEmpty}
                className="rounded-md bg-zinc-900 dark:bg-[#ebdfc6] px-4 py-2 text-sm font-medium text-white dark:text-[#2b2620] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "保存中…" : hasReview ? "💾 更新する" : "💾 保存する"}
              </button>
              {lastSavedAt && (
                <p className="text-xs text-[#6a6256]">
                  最終更新: {formatJst(lastSavedAt)}
                </p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
