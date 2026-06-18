"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealWorldActionWithContext } from "@/lib/practice/types";
import {
  createAction,
  toggleTried,
  updateReflection,
  deleteAction,
} from "@/lib/practice/actions";

type Tab = "untried" | "tried";

export function ActionsClient({
  untried,
  tried,
}: {
  untried: RealWorldActionWithContext[];
  tried: RealWorldActionWithContext[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    untried.length === 0 && tried.length > 0 ? "tried" : "untried"
  );
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [savingNew, startSavingNew] = useTransition();
  const [reflectTarget, setReflectTarget] =
    useState<RealWorldActionWithContext | null>(null);

  const list = tab === "untried" ? untried : tried;
  const totalCount = untried.length + tried.length;

  return (
    <>
      {/* タブ + 新規追加ボタン */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-full bg-zinc-100 p-1">
          <TabBtn
            active={tab === "untried"}
            onClick={() => setTab("untried")}
            label={`試してない (${untried.length})`}
          />
          <TabBtn
            active={tab === "tried"}
            onClick={() => setTab("tried")}
            label={`試した (${tried.length})`}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-[12px] font-bold text-[#34603f] hover:text-[#004d40] flex items-center gap-1"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#4a875b] text-white text-[12px]">
            +
          </span>
          新規追加
        </button>
      </div>

      {/* 一覧 */}
      {totalCount === 0 ? (
        <EmptyHero onAddClick={() => setShowNew(true)} />
      ) : list.length === 0 ? (
        <div className="bg-[#fffdf8] border border-dashed border-[#e7dcc9] rounded-2xl p-8 text-center text-[12px] text-[#6a6256]">
          {tab === "untried"
            ? "未試行のアクションはありません 🎉"
            : "まだ試した記録はありません。"}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((row) => (
            <ActionCard
              key={row.id}
              row={row}
              onCheck={() => {
                // 試してない → 試した
                startTryToggle(row.id, true, () => {
                  setReflectTarget(row);
                  setTab("tried");
                  router.refresh();
                });
              }}
              onUncheck={() => {
                startTryToggle(row.id, false, () => {
                  router.refresh();
                });
              }}
              onOpenReflect={() => setReflectTarget(row)}
              onDelete={() => {
                if (
                  !confirm("このアクションを削除します。 よろしいですか?")
                )
                  return;
                deleteAction(row.id).then((r) => {
                  if (r.ok) router.refresh();
                  else alert(r.message);
                });
              }}
            />
          ))}
        </ul>
      )}

      {/* 新規追加モーダル */}
      {showNew && (
        <Modal title="新規アクションを宣言" onClose={() => setShowNew(false)}>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="例: ジムで RPE 8 まで追い込む"
            rows={3}
            maxLength={280}
            className="w-full rounded-md border border-zinc-300 p-3 text-sm focus:outline-none focus:border-[#4a875b]"
          />
          <p className="mt-1 text-[10px] text-[#6a6256] text-right">
            {newText.length} / 280
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 text-[12px] text-zinc-600 hover:text-zinc-800"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={savingNew || newText.trim().length === 0}
              onClick={() => {
                startSavingNew(async () => {
                  const r = await createAction({ planned_action: newText });
                  if (r.ok) {
                    setNewText("");
                    setShowNew(false);
                    setTab("untried");
                    router.refresh();
                  } else {
                    alert(r.message);
                  }
                });
              }}
              className="rounded-full bg-[#4a875b] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#34603f] disabled:bg-zinc-300"
            >
              {savingNew ? "保存中..." : "宣言する"}
            </button>
          </div>
        </Modal>
      )}

      {/* 振り返りモーダル */}
      {reflectTarget && (
        <ReflectionModal
          row={reflectTarget}
          onClose={() => setReflectTarget(null)}
          onSaved={() => {
            setReflectTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );

  function startTryToggle(
    id: string,
    next: boolean,
    onDone: () => void
  ) {
    toggleTried(id, next).then((r) => {
      if (r.ok) onDone();
      else alert(r.message);
    });
  }
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "px-4 py-1.5 rounded-full bg-[#fffdf8] text-[#34603f] text-[12px] font-bold shadow-sm"
          : "px-4 py-1.5 rounded-full text-[#6a6256] text-[12px] font-medium hover:text-zinc-700"
      }
    >
      {label}
    </button>
  );
}

function EmptyHero({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="bg-[#fffdf8] border border-dashed border-[#e7dcc9] rounded-2xl p-8 text-center">
      <p className="text-[13px] text-[#6a6256] leading-relaxed">
        実践アクションがまだありません。
        <br />
        レッスン下部から宣言するか、 自発的に追加してみましょう。
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-full bg-[#4a875b] text-white px-4 py-2 text-[12px] font-bold hover:bg-[#34603f]"
        >
          自発的に追加 →
        </button>
        <Link
          href="/courses"
          className="rounded-full border border-zinc-300 text-zinc-700 px-4 py-2 text-[12px] font-bold hover:bg-[#f0e6d3]"
        >
          コースから始める →
        </Link>
      </div>
    </div>
  );
}

function ActionCard({
  row,
  onCheck,
  onUncheck,
  onOpenReflect,
  onDelete,
}: {
  row: RealWorldActionWithContext;
  onCheck: () => void;
  onUncheck: () => void;
  onOpenReflect: () => void;
  onDelete: () => void;
}) {
  const lessonHref =
    row.course_id && row.chapter_id && row.lesson_id
      ? `/courses/${row.course_id}/chapters/${row.chapter_id}/lessons/${row.lesson_id}`
      : null;

  return (
    <li className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={row.tried ? onUncheck : onCheck}
          className={
            row.tried
              ? "flex-shrink-0 w-9 h-9 rounded-full bg-[#4a875b] text-white text-[18px] font-bold flex items-center justify-center hover:bg-[#34603f] self-center"
              : "flex-shrink-0 w-9 h-9 rounded-full border-2 border-zinc-300 hover:border-[#4a875b] flex items-center justify-center text-zinc-300 hover:text-[#4a875b] self-center"
          }
          aria-label={row.tried ? "未試行に戻す" : "試したにする"}
          title={row.tried ? "未試行に戻す" : "試したにする"}
        >
          {row.tried ? "✓" : ""}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#2b2620] leading-snug whitespace-pre-wrap">
            {row.planned_action}
          </p>
          {lessonHref ? (
            <Link
              href={lessonHref}
              className="text-[10px] text-[#6a6256] hover:text-zinc-700 mt-1 inline-block truncate max-w-full"
            >
              {row.course_title} ・ {row.chapter_title} ・ {row.lesson_title}
            </Link>
          ) : (
            <p className="text-[10px] text-[#a59b8c] mt-1">自発アクション</p>
          )}
          {row.tried && row.reflection && (
            <p className="text-[12px] text-zinc-700 mt-2 bg-[#f9f5ed] rounded-md p-2 leading-relaxed whitespace-pre-wrap">
              <span className="text-[10px] text-[#6a6256] mr-1">
                振り返り:
              </span>
              {row.reflection}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            {row.tried && row.tried_at && (
              <span className="text-[#a59b8c] font-mono">
                試した日 {new Date(row.tried_at).toLocaleDateString("ja-JP")}
              </span>
            )}
            {row.tried && (
              <button
                type="button"
                onClick={onOpenReflect}
                className="text-[#34603f] hover:text-[#004d40] font-bold"
              >
                {row.reflection ? "振り返りを編集" : "振り返りを書く"}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-[#a59b8c] hover:text-rose-600"
              aria-label="削除"
              title="削除"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3"
      onClick={onClose}
    >
      <div
        className="bg-[#fffdf8] rounded-2xl w-full max-w-[440px] p-5 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#2b2620]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#a59b8c] hover:text-zinc-700 text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReflectionModal({
  row,
  onClose,
  onSaved,
}: {
  row: RealWorldActionWithContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(row.reflection ?? "");
  const [saving, startSaving] = useTransition();

  return (
    <Modal title="振り返りを書く (任意)" onClose={onClose}>
      <p className="text-[11px] text-[#6a6256] mb-2 leading-relaxed whitespace-pre-wrap">
        宣言: {row.planned_action}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="やってみて分かったこと、 感想、 次に活かすこと..."
        rows={5}
        maxLength={1000}
        className="w-full rounded-md border border-zinc-300 p-3 text-sm focus:outline-none focus:border-[#4a875b]"
      />
      <p className="mt-1 text-[10px] text-[#6a6256] text-right">
        {text.length} / 1000
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-[12px] text-zinc-600 hover:text-zinc-800"
        >
          {row.reflection ? "キャンセル" : "後で書く"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            startSaving(async () => {
              const r = await updateReflection(row.id, text);
              if (r.ok) onSaved();
              else alert(r.message);
            });
          }}
          className="rounded-full bg-[#4a875b] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#34603f] disabled:bg-zinc-300"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </Modal>
  );
}
