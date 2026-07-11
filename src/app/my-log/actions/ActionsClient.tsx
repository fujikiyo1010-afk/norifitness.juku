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

/**
 * 実践リスト Client (2026-06-18 Phase 2 ・モック準拠リデザイン)
 *
 * - タブ + 「+ 新規追加」 緑 pill
 * - カード新形式: 緑円大 ✓ + タイトル + タグ pill + 振り返りボックス + 試した日 + 編集/削除
 * - チェック → 即タブ移動 + 振り返りモーダル即出
 */
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
      {/* タブ + 新規追加 ボタン (モック準拠 ・下線タブ + 緑 pill) */}
      <div className="flex items-end justify-between mb-3.5">
        <div className="flex gap-4">
          <TabBtn
            active={tab === "untried"}
            onClick={() => setTab("untried")}
            label="試してない"
            count={untried.length}
          />
          <TabBtn
            active={tab === "tried"}
            onClick={() => setTab("tried")}
            label="試した"
            count={tried.length}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white btn3d rounded-[11px] px-3.5 py-2 transition-colors"
        >
          <span className="inline-block w-3.5 h-3.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
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
        <ul className="space-y-3.5">
          {list.map((row) => (
            <ActionCard
              key={row.id}
              row={row}
              onCheck={() => {
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
                if (!confirm("このアクションを削除します。 よろしいですか?"))
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
            className="w-full rounded-md border border-[#e7dcc9] bg-[#fffdf8] p-3 text-sm focus:outline-none focus:border-[#4a875b]"
          />
          <p className="mt-1 text-[10px] text-[#6a6256] text-right">
            {newText.length} / 280
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 text-[12px] text-[#6a6256] hover:text-[#2b2620]"
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
              className="rounded-full btn3d px-5 py-2 text-[12px] font-bold text-white"
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

  function startTryToggle(id: string, next: boolean, onDone: () => void) {
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
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-2.5 text-[14px] font-bold transition-colors border-b-2 ${
        active
          ? "text-[#2b2620] border-[#4a875b]"
          : "text-[#a59b8c] border-transparent hover:text-[#6a6256]"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 text-[13px] font-mono font-bold ${
          active ? "text-[#34603f]" : "text-[#a59b8c]"
        }`}
      >
        {count}
      </span>
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
          className="rounded-full btn3d text-white px-4 py-2 text-[12px] font-bold"
        >
          自発的に追加 →
        </button>
        <Link
          href="/courses"
          className="rounded-full border border-[#e7dcc9] text-[#6a6256] px-4 py-2 text-[12px] font-bold hover:bg-[#f0e6d3]"
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
  const isSelf = !lessonHref;

  return (
    <li
      className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[16px] p-4 flex gap-3.5"
      style={{ boxShadow: "0 8px 20px rgba(60,45,25,.05)" }}
    >
      <button
        type="button"
        onClick={row.tried ? onUncheck : onCheck}
        className={
          row.tried
            ? "flex-shrink-0 w-[38px] h-[38px] rounded-full bg-[#4a875b] text-white flex items-center justify-center hover:bg-[#34603f] self-center"
            : "flex-shrink-0 w-[38px] h-[38px] rounded-full border-[2px] border-[#a59b8c] hover:border-[#4a875b] flex items-center justify-center self-center"
        }
        aria-label={row.tried ? "未試行に戻す" : "試したにする"}
        title={row.tried ? "未試行に戻す" : "試したにする"}
      >
        {row.tried && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* タイトル */}
        <div className="text-[16px] font-bold text-[#2b2620] leading-[1.4] mb-2">
          {row.planned_action}
        </div>

        {/* タグ pill */}
        <div className="mb-2.5">
          {isSelf ? (
            <span className="inline-flex items-center text-[11px] font-bold text-[#6a6256] bg-[#efe9dd] rounded-full px-2.5 py-0.5">
              自発アクション
            </span>
          ) : (
            <Link
              href={lessonHref}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#34603f] bg-[#e9f1e9] rounded-full px-2.5 py-0.5 max-w-full overflow-hidden whitespace-nowrap text-ellipsis hover:bg-[#dde9dd] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span className="truncate">
                {row.course_title} ・ {row.chapter_title}
              </span>
            </Link>
          )}
        </div>

        {/* 振り返り (試した + reflection あるとき) */}
        {row.tried && row.reflection && (
          <div className="mb-3">
            <div className="text-[11px] font-bold text-[#d9743f] tracking-wider mb-0.5">
              振り返り
            </div>
            <div className="text-[14.5px] text-[#2b2620] leading-[1.75] whitespace-pre-wrap">
              {row.reflection}
            </div>
          </div>
        )}

        {/* meta 行: 試した日 + 編集 + × (上に境界線) */}
        <div className="pt-2.5 border-t border-[#e7dcc9] flex items-center gap-3">
          {row.tried && row.tried_at ? (
            <div className="text-[11.5px] text-[#6a6256]">
              試した日{" "}
              <b className="font-bold font-mono text-[#6a6256]">
                {new Date(row.tried_at).toLocaleDateString("ja-JP")}
              </b>
            </div>
          ) : (
            <div className="text-[11.5px] text-[#a59b8c]">宣言済</div>
          )}
          {row.tried && (
            <button
              type="button"
              onClick={onOpenReflect}
              className="text-[12.5px] font-bold text-[#34603f] hover:text-[#2b4c2d]"
            >
              {row.reflection ? "振り返りを編集" : "振り返りを書く"}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-[#a59b8c] hover:text-[#d9743f]"
            aria-label="削除"
            title="削除"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
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
            className="text-[#a59b8c] hover:text-[#2b2620] text-xl leading-none"
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
        className="w-full rounded-md border border-[#e7dcc9] bg-[#fffdf8] p-3 text-sm focus:outline-none focus:border-[#4a875b]"
      />
      <p className="mt-1 text-[10px] text-[#6a6256] text-right">
        {text.length} / 1000
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-[12px] text-[#6a6256] hover:text-[#2b2620]"
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
          className="rounded-full btn3d px-5 py-2 text-[12px] font-bold text-white"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </Modal>
  );
}
