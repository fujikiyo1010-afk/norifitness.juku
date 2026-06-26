"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { distributeMenu } from "@/lib/workout/actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  cleanExerciseName,
  cleanDayLabel,
  getExerciseTarget,
  validateMenuForDistribution,
} from "@/lib/workout/menu-display";
import {
  resolveExerciseVideo,
  listExerciseMaster,
  listExercisesWithVideo,
  videoNameByUrl,
  partByExerciseName,
} from "@/lib/workout/video-master";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import type {
  WorkoutCycles,
  WorkoutTemplateRow,
  DayMenu,
  Exercise,
} from "@/lib/workout/types";

// 主部位マスター (種目編集用、2026-06-25 部位8カテゴリ統一: 体幹→腹筋・有酸素削除)
const TARGET_PART_OPTIONS = [
  "胸",
  "背中",
  "肩",
  "腕",
  "脚",
  "お尻",
  "腹筋",
  "全身",
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
  backHref,
  backLabel,
  fromRequest = false,
  requestId = null,
}: {
  userId: string;
  userName: string;
  initialCycles: WorkoutCycles;
  initialNotes: string;
  templateId: string | null;
  sourceTemplate: WorkoutTemplateRow | null;
  /** ヘッダ戻るボタンの遷移先。テンプレ採用時は match、現メニュー編集時はハブ */
  backHref: string;
  backLabel: string;
  fromRequest?: boolean;
  requestId?: string | null;
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

  // 強度間で同期するフィールド (種目名/順番/主部位/補部位 は B/C/D の中で共通、
  // 回数/インターバル は強度差として個別保持)
  const SYNC_FIELDS: ReadonlyArray<keyof Exercise> = [
    "種目名",
    "順番",
    "主部位",
    "補部位",
    "video_url", // 動画は同じ種目なら強度間で共通 (2026-06-25 W3a)
    "superset", // スーパーセットも種目の性質なので強度間で共通
  ];

  // すべての強度の同じ日 index に mutation を適用 (該当 day がない強度はスキップ)
  function applyToAllStrengthsAtSameDay(
    mutator: (exercises: Exercise[]) => void
  ) {
    setCycles((cs) => {
      const next = structuredClone(cs);
      next.forEach((cycle) => {
        const day = cycle["週"]?.[activeDayIdx];
        if (!day || !day["種目"]) return;
        mutator(day["種目"]);
      });
      return next;
    });
  }

  // 種目削除 (全強度で同位置を削除)
  function deleteExercise(idx: number) {
    applyToAllStrengthsAtSameDay((arr) => {
      if (idx < arr.length) arr.splice(idx, 1);
    });
  }

  // 種目を上に移動 (全強度で同期)
  function moveUp(idx: number) {
    if (idx === 0) return;
    applyToAllStrengthsAtSameDay((arr) => {
      if (idx > 0 && idx < arr.length) {
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      }
    });
  }

  // 種目を下に移動 (全強度で同期)
  function moveDown(idx: number) {
    applyToAllStrengthsAtSameDay((arr) => {
      if (idx >= 0 && idx < arr.length - 1) {
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      }
    });
  }

  // 種目を追加 (末尾、全強度に同じ内容を追加。回数/インターバルは初期値共通、後で個別調整可)
  function addExercise() {
    const seedLength =
      cycles[activeCycleIdx]?.["週"]?.[activeDayIdx]?.["種目"]?.length ?? 0;
    const orderLabel = String(seedLength + 1);
    applyToAllStrengthsAtSameDay((arr) => {
      arr.push({
        順番: orderLabel,
        種目名: "",
        回数: "10回 3セット",
        インターバル: "2分",
        主部位: [],
        補部位: [],
      });
    });
  }

  // 種目編集 (フィールド単位)。種目名/順番/主部位/補部位 は全強度同期、回数/インターバルは active のみ。
  function updateExercise<K extends keyof Exercise>(
    idx: number,
    key: K,
    value: Exercise[K]
  ) {
    const shouldSync = SYNC_FIELDS.includes(key);
    if (shouldSync) {
      applyToAllStrengthsAtSameDay((arr) => {
        if (idx < arr.length) {
          arr[idx][key] = value;
        }
      });
    } else {
      // 回数 / インターバル: 強度差として個別保持
      setCycles((cs) => {
        const next = structuredClone(cs);
        const arr = next[activeCycleIdx]?.["週"]?.[activeDayIdx]?.["種目"];
        if (arr && idx < arr.length) {
          arr[idx][key] = value;
        }
        return next;
      });
    }
  }

  // 位置ベース採番: 並び順から 日 ラベルを「N日目」に振り直す (種別/種目は保持)
  function renumberDays(week: DayMenu[]) {
    week.forEach((d, i) => {
      d["日"] = `${i + 1}日目`;
    });
  }

  // ===== 日(週)操作: 全強度で同期 + 毎回 位置ベース採番 =====
  function applyDayOp(op: (week: DayMenu[]) => void) {
    setCycles((cs) => {
      const next = structuredClone(cs);
      next.forEach((cycle) => {
        if (cycle["週"]) {
          op(cycle["週"]);
          renumberDays(cycle["週"]); // 複製/移動/削除のたびに 1日目〜 を自動採番
        }
      });
      return next;
    });
  }

  // 今の日を左右に移動 (隣と入れ替え・全強度同期・採番は applyDayOp が実施)
  function moveDay(dir: -1 | 1) {
    const idx = activeDayIdx;
    const len = activeCycle?.["週"]?.length ?? 0;
    const target = idx + dir;
    if (target < 0 || target >= len) return;
    applyDayOp((week) => {
      if (idx < week.length && target < week.length) {
        [week[idx], week[target]] = [week[target], week[idx]];
      }
    });
    setActiveDayIdx(target);
  }

  // 空の日を末尾に追加 (全強度)
  function addDay() {
    const newIdx = activeCycle?.["週"]?.length ?? 0;
    applyDayOp((week) => {
      week.push({ 日: `${week.length + 1}日目`, 種目: [] });
    });
    setActiveDayIdx(newIdx);
  }

  // 今の日を直後に複製 (全強度)
  function duplicateDay() {
    const idx = activeDayIdx;
    applyDayOp((week) => {
      if (idx < week.length) {
        week.splice(idx + 1, 0, structuredClone(week[idx]));
      }
    });
    setActiveDayIdx(idx + 1);
  }

  // 今の日を削除 (全強度・最低1日は残す)
  function deleteDay() {
    const idx = activeDayIdx;
    const len = activeCycle?.["週"]?.length ?? 0;
    if (len <= 1) return;
    applyDayOp((week) => {
      if (week.length > 1 && idx < week.length) week.splice(idx, 1);
    });
    setActiveDayIdx(Math.max(0, Math.min(idx, len - 2)));
  }

  // 日種別の設定/解除 (全強度・休息/パーソナルは種目を空にする)
  function setDayType(type: "休息" | "パーソナル" | null) {
    const idx = activeDayIdx;
    applyDayOp((week) => {
      if (idx >= week.length) return;
      if (type) {
        week[idx]["種別"] = type;
        week[idx]["種目"] = [];
      } else {
        delete week[idx]["種別"];
      }
    });
  }

  // 強度(サイクル)切替。今見ている日(activeDayIdx)は維持し、
  // 切替先の強度に同じ日が無い場合だけ範囲内へ丸める。
  // (例: B の小 を見ていて 中 を押しても A に飛ばず B のまま中を見られる)
  function handleCycleChange(idx: number) {
    setActiveCycleIdx(idx);
    setActiveDayIdx((prev) => {
      const dayCount = cycles[idx]?.["週"]?.length ?? 0;
      return Math.min(prev, Math.max(0, dayCount - 1));
    });
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
        // リクエスト経由なら 返信フォームへ自動で戻す (= /admin/requests 右ペイン展開)
        if (fromRequest && requestId) {
          router.push(`/admin/requests?id=${requestId}&type=workout`);
          router.refresh();
          return;
        }
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
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label={backLabel}
            title={backLabel}
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

      {/* リクエスト処理中バナー (= /admin/requests から「メニューを編集」 で来た時のみ) */}
      {fromRequest && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-amber-900">
              <span className="font-bold">リクエスト処理中です</span>
              <span className="ml-2 text-xs text-amber-800">
                配布 → 返信フォームに自動で戻ります
              </span>
            </div>
            <Link
              href={`/admin/requests?id=${requestId}&type=workout`}
              className="text-xs text-amber-900 underline hover:no-underline"
            >
              リクエストに戻る →
            </Link>
          </div>
        </div>
      )}

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

        {/* 強度選択 */}
        {cycles.length > 1 && (
          <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-4">
            <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-1.5">
              強度
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
                  {c["段階"] || `強度${i + 1}`}
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
                    {w["種別"] ? `${w["種別"]}日` : `${w["種目"]?.length ?? 0} 種目`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 日の操作 (複製/空追加/削除/休息・パーソナル) */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold text-zinc-500 tracking-widest">
              日の操作
            </div>
            <div className="text-xs text-zinc-600">
              現在:{" "}
              <span className="font-bold text-zinc-900">
                {cleanDayLabel(activeDay?.["日"] ?? "") || `${activeDayIdx + 1}日目`}
              </span>
              {activeDay?.["種別"] && (
                <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {activeDay["種別"]}日
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => moveDay(-1)}
              disabled={activeDayIdx === 0}
              className="rounded-md border border-[#e8ebe9] bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-[#00897b] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="この日を左へ"
              title="この日を左へ移動"
            >
              ← 左へ
            </button>
            <button
              type="button"
              onClick={() => moveDay(1)}
              disabled={activeDayIdx >= dayCount - 1}
              className="rounded-md border border-[#e8ebe9] bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-[#00897b] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="この日を右へ"
              title="この日を右へ移動"
            >
              右へ →
            </button>
            <span className="mx-1 w-px self-stretch bg-[#e8ebe9]" />
            <button
              type="button"
              onClick={addDay}
              className="rounded-md border border-dashed border-[#00897b] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#00695c] hover:bg-[rgba(0,137,123,0.08)]"
            >
              ＋空の日
            </button>
            <button
              type="button"
              onClick={duplicateDay}
              className="rounded-md border border-[#e8ebe9] bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-[#00897b]"
            >
              この日を複製
            </button>
            <button
              type="button"
              onClick={deleteDay}
              disabled={dayCount <= 1}
              className="rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              この日を削除
            </button>
            <span className="mx-1 w-px self-stretch bg-[#e8ebe9]" />
            <button
              type="button"
              onClick={() =>
                setDayType(activeDay?.["種別"] === "休息" ? null : "休息")
              }
              className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${
                activeDay?.["種別"] === "休息"
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-[#e8ebe9] bg-white text-zinc-600 hover:border-amber-400"
              }`}
            >
              {activeDay?.["種別"] === "休息" ? "休息を解除" : "休息日にする"}
            </button>
            <button
              type="button"
              onClick={() =>
                setDayType(activeDay?.["種別"] === "パーソナル" ? null : "パーソナル")
              }
              className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${
                activeDay?.["種別"] === "パーソナル"
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-[#e8ebe9] bg-white text-zinc-600 hover:border-amber-400"
              }`}
            >
              {activeDay?.["種別"] === "パーソナル"
                ? "パーソナルを解除"
                : "パーソナル日にする"}
            </button>
          </div>
        </section>

        {/* 種目名オートコンプリート候補 (確定代表名198・全行で共有) */}
        <datalist id="exercise-name-options">
          {listExerciseMaster().map((e) => (
            <option key={e.確定代表名} value={e.確定代表名} />
          ))}
        </datalist>

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

          {activeDay?.["種別"] ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              この日は「{activeDay["種別"]}」です。
              {activeDay["種別"] === "パーソナル"
                ? "受講生は外部のパーソナル指導を受けます。"
                : "休息日です。"}
              <br />
              こちらのメニュー (種目) はありません。
            </div>
          ) : exercises.length === 0 ? (
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

          {/* 種目追加 (休息/パーソナル日は非表示) */}
          {!activeDay?.["種別"] && (
            <div className="px-4 py-3 border-t border-[#e8ebe9] bg-[#fafafa]">
              <button
                type="button"
                onClick={addExercise}
                className="w-full px-4 py-2.5 rounded-md border border-dashed border-[#00897b] bg-white text-[#00695c] text-xs font-bold hover:bg-[rgba(0,137,123,0.08)] transition-colors"
              >
                + 種目を追加
              </button>
            </div>
          )}
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
            {userName} に {totalExercises} 種目 / {cycles.length} 強度で配布
          </div>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={isPending}
            className="rounded-[4px] bg-[#00897b] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#00695c] disabled:opacity-50"
          >
            {isPending ? (
              <>
                <LoadingSpinner /> 配布中…
              </>
            ) : fromRequest ? (
              "配布して 返信フォームへ →"
            ) : (
              "配布する"
            )}
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

  // 動画 (W3a): 実効URL・上書き状態・表示名
  const videoUrl = resolveExerciseVideo(ex);
  const isVideoOverride = ex.video_url !== undefined; // 既定でなく明示設定あり
  const videoName = videoNameByUrl(videoUrl);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const videoChoices = listExercisesWithVideo();
  const filteredChoices = pickerQ.trim()
    ? videoChoices.filter(
        (c) =>
          c.確定代表名.includes(pickerQ.trim()) ||
          c.動画名.includes(pickerQ.trim())
      )
    : videoChoices;

  return (
    <div className="px-4 py-4 border-b border-[#e8ebe9] last:border-b-0">
      <div className="flex items-start gap-3">
        {/* 番号 */}
        <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 font-bold font-mono text-sm flex items-center justify-center flex-shrink-0">
          {num}
        </div>

        {/* 編集フィールド */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 種目名 (オートコンプリート: 確定代表名から候補 + 自由入力も可)
              種目を選ぶと主部位が空なら自動補完 (③) */}
          <input
            type="text"
            value={displayName}
            list="exercise-name-options"
            onChange={(e) => {
              const v = e.target.value;
              onUpdate("種目名", v);
              const part = partByExerciseName(v);
              if (part && (ex["主部位"] ?? []).length === 0) {
                onUpdate("主部位", [part]);
              }
            }}
            placeholder="種目名 (入力で候補表示 / 自由入力も可)"
            className="w-full px-3 py-2 text-sm font-bold text-zinc-900 border border-[#e8ebe9] rounded-md bg-white focus:outline-none focus:border-[#00897b]"
          />

          {/* スーパーセット (交互) トグル (②) */}
          <label className="flex w-fit items-center gap-1.5 text-[11px] font-medium text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!ex["superset"]}
              onChange={(e) => onUpdate("superset", e.target.checked)}
              className="accent-[#00897b]"
            />
            🔁 スーパーセット（交互に行う）
          </label>

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

          {/* 動画 (W3a): あり/なし表示 + 「この動画に変更」(このメニュー限定) */}
          <div>
            <div className="mb-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest">
                動画
              </span>
              {videoUrl ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00695c]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {videoName ?? "あり"}
                  {isVideoOverride && (
                    <span className="text-amber-600">(変更済)</span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-zinc-400">
                  なし{isVideoOverride && "(手動オフ)"}
                </span>
              )}
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((o) => !o)}
                  className="rounded-md border border-[#e8ebe9] bg-white px-2 py-1 text-[10px] font-bold text-zinc-600 hover:border-[#00897b] hover:text-[#00695c]"
                >
                  {previewOpen ? "プレビューを閉じる" : "プレビュー"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="ml-auto rounded-md border border-[#e8ebe9] bg-white px-2 py-1 text-[10px] font-bold text-zinc-600 hover:border-[#00897b] hover:text-[#00695c]"
              >
                {videoUrl ? "動画を変更" : "動画を付ける"}
              </button>
            </div>

            {/* プレビュー (受講生と同じ埋め込み再生。直リンクは embed 限定で不可のため) */}
            {previewOpen && videoUrl && (
              <div className="mb-2 max-w-sm">
                <VimeoEmbed url={videoUrl} />
              </div>
            )}

            {pickerOpen && (
              <div className="rounded-md border border-[#e8ebe9] bg-[#fafafa] p-2">
                <input
                  type="text"
                  value={pickerQ}
                  onChange={(e) => setPickerQ(e.target.value)}
                  placeholder="動画を名前で検索 (例: ローイング)"
                  className="mb-2 w-full rounded-md border border-[#e8ebe9] bg-white px-2 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-[#00897b]"
                />
                <div className="max-h-40 overflow-y-auto rounded border border-[#eef0ef] bg-white">
                  {filteredChoices.slice(0, 60).map((c) => {
                    const isCurrent = c.video_url === videoUrl;
                    return (
                      <button
                        key={c.確定代表名}
                        type="button"
                        onClick={() => {
                          onUpdate("video_url", c.video_url);
                          setPickerOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 border-b border-[#f3f4f3] px-2 py-1.5 text-left text-[11px] last:border-b-0 hover:bg-[rgba(0,137,123,0.06)] ${
                          isCurrent ? "bg-[rgba(0,137,123,0.08)]" : ""
                        }`}
                      >
                        <span className="font-bold text-zinc-800">
                          {c.確定代表名}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {c.部位}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto text-[10px] font-bold text-[#00695c]">
                            選択中
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {filteredChoices.length === 0 && (
                    <div className="px-2 py-3 text-center text-[10px] text-zinc-400">
                      該当する動画がありません
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate("video_url", undefined);
                      setPickerOpen(false);
                    }}
                    className="flex-1 rounded-md border border-[#e8ebe9] bg-white px-2 py-1.5 text-[10px] font-bold text-zinc-600 hover:border-[#00897b]"
                  >
                    既定に戻す
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate("video_url", "");
                      setPickerOpen(false);
                    }}
                    className="flex-1 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-[10px] font-bold text-rose-500 hover:bg-rose-50"
                  >
                    動画なしにする
                  </button>
                </div>
              </div>
            )}
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
