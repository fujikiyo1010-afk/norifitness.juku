"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { distributeMenu } from "@/lib/workout/actions";
import {
  cleanExerciseName,
  cleanDayLabel,
  getExerciseTarget,
  validateMenuForDistribution,
} from "@/lib/workout/menu-display";
import type {
  WorkoutCycles,
  WorkoutTemplateRow,
  DayMenu,
  Exercise,
} from "@/lib/workout/types";

// 主部位マスター (種目編集用、きよむさん確認済 2026-06-02)
const TARGET_PART_OPTIONS = [
  "胸",
  "背中",
  "肩",
  "腕",
  "脚",
  "お尻",
  "体幹",
  "全身",
  "有酸素",
] as const;

/**
 * メニュー配布 Client Component (MVP-β)
 *
 * 機能:
 *   - サイクル選択タブ
 *   - 日選択タブ
 *   - 種目: 削除 / 順序変更 (上下) / インライン追加 / インライン編集
 *   - のり氏メモ編集 (デフォルトテンプレ自動入力済、テキストエリアで自由編集)
 *   - 配布ボタン → distributeMenu Server Action
 */
export function MenuComposeClient({
  userId,
  userName,
  initialCycles,
  initialNotes,
  templateId,
  sourceTemplate,
}: {
  userId: string;
  userName: string;
  initialCycles: WorkoutCycles;
  initialNotes: string;
  templateId: string | null;
  sourceTemplate: WorkoutTemplateRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cycles, setCycles] = useState<WorkoutCycles>(initialCycles);
  const [notes, setNotes] = useState(initialNotes);
  const [activeCycleIdx, setActiveCycleIdx] = useState(0);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const activeCycle = cycles[activeCycleIdx];
  const activeDay: DayMenu | undefined = activeCycle?.["週"]?.[activeDayIdx];
  const exercises: Exercise[] = activeDay?.["種目"] || [];

  // 種目削除
  function deleteExercise(idx: number) {
    setCycles((cs) => {
      const next = structuredClone(cs);
      next[activeCycleIdx]["週"][activeDayIdx]["種目"].splice(idx, 1);
      return next;
    });
  }

  // 種目を上に移動
  function moveUp(idx: number) {
    if (idx === 0) return;
    setCycles((cs) => {
      const next = structuredClone(cs);
      const arr = next[activeCycleIdx]["週"][activeDayIdx]["種目"];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return next;
    });
  }

  // 種目を下に移動
  function moveDown(idx: number) {
    setCycles((cs) => {
      const next = structuredClone(cs);
      const arr = next[activeCycleIdx]["週"][activeDayIdx]["種目"];
      if (idx === arr.length - 1) return cs;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return next;
    });
  }

  // 種目を追加 (末尾)
  function addExercise() {
    setCycles((cs) => {
      const next = structuredClone(cs);
      next[activeCycleIdx]["週"][activeDayIdx]["種目"].push({
        順番: String(
          next[activeCycleIdx]["週"][activeDayIdx]["種目"].length + 1
        ),
        種目名: "",
        回数: "10回 3セット",
        インターバル: "2分",
        主部位: [],
        補部位: [],
      });
      return next;
    });
  }

  // 種目編集 (フィールド単位)
  function updateExercise<K extends keyof Exercise>(
    idx: number,
    key: K,
    value: Exercise[K]
  ) {
    setCycles((cs) => {
      const next = structuredClone(cs);
      next[activeCycleIdx]["週"][activeDayIdx]["種目"][idx][key] = value;
      return next;
    });
  }

  // サイクル切替
  function handleCycleChange(idx: number) {
    setActiveCycleIdx(idx);
    setActiveDayIdx(0);
  }

  // 配布実行
  function handleDistribute() {
    const validation = validateMenuForDistribution(cycles, notes);
    if (!validation.ok) {
      setErrors(validation.errors);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }
    setErrors([]);

    startTransition(async () => {
      const result = await distributeMenu({
        user_id: userId,
        template_id: templateId,
        template_snapshot: sourceTemplate,
        cycles,
        notes: notes.trim(),
      });
      if (result.ok) {
        router.push(`/admin/users/${userId}`);
      } else {
        setErrors([result.message]);
      }
    });
  }

  const dayCount = activeCycle?.["週"]?.length ?? 0;
  const totalExercises = cycles.reduce(
    (sum, c) =>
      sum + c["週"].reduce((s, w) => s + (w["種目"]?.length ?? 0), 0),
    0
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href={`/admin/users/${userId}/match`}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label="マッチング検索に戻る"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-zinc-900">
              メニュー配布
            </h1>
            <p className="text-xs text-zinc-600">
              {userName} 宛 / 全 {totalExercises} 種目
            </p>
          </div>
          {sourceTemplate && (
            <span className="rounded-full bg-[rgba(0,137,123,0.08)] px-3 py-1 text-xs font-bold text-[#00695c]">
              {sourceTemplate.source_name} さんメニュー ベース
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5 pb-32">
        {/* のり氏メモ編集 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              のりfitness メモ
            </h2>
            <span className="text-[10px] font-medium text-rose-600">必須</span>
          </div>
          <p className="mb-3 text-xs text-zinc-600 leading-relaxed">
            受講生のメニュー画面に表示されます。
            <br />
            デフォルト文を編集して、受講生に合わせた個別メッセージにできます (1 行 1 ポイント、空行は自動で除去)。
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full px-3 py-2.5 text-[13px] border border-[#e8ebe9] rounded-[10px] bg-white text-zinc-900 resize-y leading-relaxed focus:outline-none focus:border-[#00897b]"
          />
          <div className="mt-1.5 text-[10px] text-zinc-400 text-right">
            {notes.length} / 2000
          </div>
        </section>

        {/* サイクル選択 */}
        {cycles.length > 1 && (
          <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-4">
            <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-1.5">
              サイクル
            </div>
            <div className="flex gap-1.5">
              {cycles.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCycleChange(i)}
                  className={`flex-1 py-2 rounded-md text-xs font-bold border transition-colors ${
                    i === activeCycleIdx
                      ? "border-2 border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                      : "border border-[#e8ebe9] bg-white text-zinc-500 hover:border-[#00897b]"
                  }`}
                >
                  <span className="font-mono text-[10px] text-zinc-400 mr-1">
                    {i + 1}:
                  </span>
                  {c["段階"] || `サイクル${i + 1}`}
                  <span className="ml-1 text-[10px] text-zinc-400 font-mono">
                    ({c["週"].reduce((s, w) => s + (w["種目"]?.length ?? 0), 0)}種目)
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 日タブ */}
        {dayCount > 1 && (
          <section className="rounded-[14px] border border-[#e8ebe9] bg-white overflow-hidden">
            <div className="flex overflow-x-auto">
              {activeCycle["週"].map((w, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveDayIdx(i)}
                  className={`flex-1 min-w-[80px] py-3 px-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                    i === activeDayIdx
                      ? "text-[#00695c] border-[#00897b]"
                      : "text-zinc-500 border-transparent"
                  }`}
                >
                  {cleanDayLabel(w["日"])}
                  <span className="block text-[9px] text-zinc-400 mt-0.5">
                    {w["種目"]?.length ?? 0} 種目
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 種目編集 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8ebe9] flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              種目編集
              <span className="ml-2 text-[11px] font-medium text-zinc-500">
                ({exercises.length} 種目)
              </span>
            </h2>
          </div>

          {exercises.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              この日の種目はまだありません。下の「+ 種目を追加」で追加してください。
            </div>
          ) : (
            <div>
              {exercises.map((ex, idx) => (
                <ExerciseEditor
                  key={idx}
                  num={idx + 1}
                  ex={ex}
                  isFirst={idx === 0}
                  isLast={idx === exercises.length - 1}
                  onUpdate={(key, value) => updateExercise(idx, key, value)}
                  onDelete={() => deleteExercise(idx)}
                  onMoveUp={() => moveUp(idx)}
                  onMoveDown={() => moveDown(idx)}
                />
              ))}
            </div>
          )}

          {/* 種目追加 */}
          <div className="px-4 py-3 border-t border-[#e8ebe9] bg-[#fafafa]">
            <button
              type="button"
              onClick={addExercise}
              className="w-full px-4 py-2.5 rounded-md border border-dashed border-[#00897b] bg-white text-[#00695c] text-xs font-bold hover:bg-[rgba(0,137,123,0.08)] transition-colors"
            >
              + 種目を追加
            </button>
          </div>
        </section>

        {/* エラー (複数項目対応) */}
        {errors.length > 0 && (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-4">
            <div className="mb-2 text-xs font-bold text-rose-800">
              配布できません ({errors.length} 項目)
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-rose-800">
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* フッタ固定 (配布ボタン) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#e8ebe9] bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex-1 text-xs text-zinc-600">
            {userName} に {totalExercises} 種目 / {cycles.length} サイクルで配布
          </div>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={isPending}
            className="rounded-[4px] bg-[#00897b] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#00695c] disabled:opacity-50"
          >
            {isPending ? "配布中..." : "配布する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 種目編集行
// =====================================================================

function ExerciseEditor({
  num,
  ex,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  num: number;
  ex: Exercise;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: <K extends keyof Exercise>(key: K, value: Exercise[K]) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const displayName = cleanExerciseName(ex["種目名"]);
  const target = getExerciseTarget(ex["主部位"]);

  return (
    <div className="px-4 py-4 border-b border-[#e8ebe9] last:border-b-0">
      <div className="flex items-start gap-3">
        {/* 番号 */}
        <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 font-bold font-mono text-sm flex items-center justify-center flex-shrink-0">
          {num}
        </div>

        {/* 編集フィールド */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 種目名 */}
          <input
            type="text"
            value={displayName}
            onChange={(e) => onUpdate("種目名", e.target.value)}
            placeholder="種目名 (例: ベンチプレス)"
            className="w-full px-3 py-2 text-sm font-bold text-zinc-900 border border-[#e8ebe9] rounded-md bg-white focus:outline-none focus:border-[#00897b]"
          />

          <div className="grid grid-cols-2 gap-2">
            {/* 回数 */}
            <input
              type="text"
              value={ex["回数"] || ""}
              onChange={(e) => onUpdate("回数", e.target.value)}
              placeholder="回数 (例: 10回 3セット)"
              className="w-full px-3 py-2 text-xs text-zinc-900 border border-[#e8ebe9] rounded-md bg-white font-mono focus:outline-none focus:border-[#00897b]"
            />

            {/* インターバル */}
            <input
              type="text"
              value={ex["インターバル"] || ""}
              onChange={(e) => onUpdate("インターバル", e.target.value)}
              placeholder="休憩 (例: 2分)"
              className="w-full px-3 py-2 text-xs text-zinc-900 border border-[#e8ebe9] rounded-md bg-white font-mono focus:outline-none focus:border-[#00897b]"
            />
          </div>

          {/* 主部位編集 (ピル型、複数選択可) */}
          <div>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest">
                狙い部位
              </span>
              {ex["主部位"]?.length > 0 ? (
                <span className="text-[10px] text-[#00695c] font-bold">
                  → {target}
                </span>
              ) : (
                <span className="text-[10px] text-rose-500 font-bold">
                  ※ 未選択 (新規追加時は必須)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TARGET_PART_OPTIONS.map((part) => {
                const selected = (ex["主部位"] ?? []).includes(part);
                return (
                  <button
                    key={part}
                    type="button"
                    onClick={() => {
                      const current = ex["主部位"] ?? [];
                      const next = selected
                        ? current.filter((p) => p !== part)
                        : [...current, part];
                      onUpdate("主部位", next);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                      selected
                        ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {selected && <span className="mr-0.5">✓</span>}
                    {part}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 操作ボタン群 */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#e8ebe9] bg-white text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="上に移動"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 flex items-center justify-center rounded border border-[#e8ebe9] bg-white text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="下に移動"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded border border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
            aria-label="削除"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
