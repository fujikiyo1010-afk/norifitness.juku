"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealWorldActionRow } from "@/lib/practice/types";
import {
  createAction,
  toggleTried,
  deleteAction,
} from "@/lib/practice/actions";

/**
 * レッスン詳細ページ下部の「今週これを試す」 入力欄 (2026-06-18 線① #5)
 *
 * - lessonId 指定で createAction(lesson_id=lesson.id)
 * - 既存アクション (= 同レッスンに紐づくもの) を下に列挙、 □ チェック可
 * - 完了履歴 1 行表示 + 一覧へのリンク
 */
export function PracticeInput({
  lessonId,
  existing,
}: {
  lessonId: string;
  existing: RealWorldActionRow[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, startSaving] = useTransition();

  const untried = existing.filter((r) => !r.tried);
  const tried = existing.filter((r) => r.tried);

  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#00695c]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </span>
        <h3 className="text-sm font-bold text-zinc-900">今週これを試す</h3>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
        このレッスンで学んだことを 1 行で宣言しましょう。 試したら振り返りを残せます。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: ジムで RPE 8 まで追い込む"
        rows={2}
        maxLength={280}
        className="w-full rounded-md border border-zinc-300 p-2.5 text-sm focus:outline-none focus:border-[#00897b]"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{text.length} / 280</span>
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
                router.refresh();
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

      {/* 既存アクション (= 同レッスンに紐づくもの) */}
      {existing.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-100 space-y-1.5">
          {untried.map((row) => (
            <ExistingRow
              key={row.id}
              row={row}
              onCheck={() => {
                toggleTried(row.id, true).then((r) => {
                  if (r.ok) router.refresh();
                  else alert(r.message);
                });
              }}
              onDelete={() => {
                if (!confirm("削除します。 よろしいですか?")) return;
                deleteAction(row.id).then((r) => {
                  if (r.ok) router.refresh();
                  else alert(r.message);
                });
              }}
            />
          ))}
          {tried.length > 0 && (
            <div className="text-[11px] text-zinc-500 pt-2">
              試した: {tried.length} 件 ・
              <Link
                href="/my-log/actions"
                className="text-[#00695c] hover:underline ml-1"
              >
                一覧で振り返り編集 →
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ExistingRow({
  row,
  onCheck,
  onDelete,
}: {
  row: RealWorldActionRow;
  onCheck: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <button
        type="button"
        onClick={onCheck}
        className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-300 hover:border-[#00897b] mt-0.5"
        aria-label="試したにする"
        title="試したにする"
      />
      <span className="flex-1 text-zinc-800 leading-snug whitespace-pre-wrap">
        {row.planned_action}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="text-zinc-400 hover:text-rose-600 text-sm flex-shrink-0"
        aria-label="削除"
        title="削除"
      >
        ×
      </button>
    </div>
  );
}
