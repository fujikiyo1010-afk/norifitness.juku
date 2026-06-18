"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAction } from "@/lib/practice/actions";

/**
 * レッスン詳細ページの「今週これを試す」 入力欄 (2026-06-18 線① #5)
 *
 * - アコーディオン UI (ReviewAccordion と同じ折り畳み)
 * - lessonId 指定で createAction(lesson_id=lesson.id)
 * - 既存アクションの表示は無し (= /my-log/actions で確認)
 * - 入力 → 宣言 → 入力欄クリア → 「実践リストに追加されました」 表示
 *
 * 設計改善 (2026-06-18 きよむさん指示):
 *   - アコーディオン化 (= 縦幅短く)
 *   - 既存リスト表示は削除 (= 違和感解消)
 *   - 一覧は /my-log/actions に集約
 */
export function PracticeInput({
  lessonId,
  existingCount,
}: {
  lessonId: string;
  existingCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, startSaving] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-zinc-50 transition-colors"
      >
        <span className="text-zinc-500 text-sm shrink-0">
          {isOpen ? "▼" : "▶"}
        </span>
        <span className="text-base font-semibold text-zinc-900">
          🚀 今週これを試す
        </span>
        <span className="text-xs text-zinc-500">(任意)</span>
        {existingCount > 0 && !isOpen && (
          <span className="ml-auto text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
            {existingCount} 件宣言済
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-t border-zinc-200 p-4 space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            このレッスンで学んだことを 1 行で宣言しましょう。 試したら振り返りを残せます。
            <br />
            一覧と振り返り編集は{" "}
            <Link
              href="/my-log/actions"
              className="text-[#00695c] hover:underline font-bold"
            >
              学習 → 実践リスト
            </Link>
            から。
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (justSaved) setJustSaved(false);
            }}
            placeholder="例: ジムで RPE 8 まで追い込む"
            rows={2}
            maxLength={280}
            className="w-full rounded-md border border-zinc-300 p-2.5 text-sm focus:outline-none focus:border-[#00897b]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">{text.length} / 280</span>
            <div className="flex items-center gap-3">
              {justSaved && (
                <span className="text-xs text-emerald-700 font-medium">
                  ✓ 実践リストに追加しました
                </span>
              )}
              <button
                type="button"
                disabled={saving || text.trim().length === 0}
                onClick={() => {
                  startSaving(async () => {
                    const r = await createAction({
                      planned_action: text,
                      lesson_id: lessonId,
                    });
                    if (r.ok) {
                      setText("");
                      setJustSaved(true);
                      router.refresh();
                      setTimeout(() => setJustSaved(false), 4000);
                    } else {
                      alert(r.message);
                    }
                  });
                }}
                className="rounded-full bg-[#00897b] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-[#00695c] disabled:bg-zinc-300"
              >
                {saving ? "保存中..." : "宣言する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
