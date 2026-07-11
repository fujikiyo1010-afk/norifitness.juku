"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Exercise, WorkoutCycles } from "@/lib/workout/types";
import {
  resolveDayMenu,
  parseRepsSets,
  dayCount,
  INTENSITY_LABEL,
  type Intensity,
  type LoggedItem,
} from "@/lib/workout/logs-types";
import { cleanExerciseName, cleanReps, getExerciseTarget } from "@/lib/workout/menu-display";
import {
  resolveExerciseVideo,
  lookupVideoByName,
  listExercisesWithVideo,
} from "@/lib/workout/video-master";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { BottomSheet } from "@/app/record/BottomSheet";
import { completeWorkoutDay } from "@/lib/workout/logs-actions";

/**
 * 実施記録 A画面 + 編集モード + スキップ(M8/M9・P5-2/PR-T3・ベータ)。
 *  - view: 種目リスト表示 + ✓今日のトレ完了 + 編集する + 今日はやらない(スキップ)。
 *  - edit(決A・2ステップ): 数値チップ→展開ステッパー + ✕/戻す + ＋種目追加 → ✓編集完了。
 *    「編集完了」はDBに書かずviewへ戻り、編集内容を保持表示。保存は view の「今日のトレ完了」でのみ。
 *  - 決B: 追加種目は回数・セット必須(完了/編集完了時)。原本種目はnull可(0→未入力)。
 */

type EditItem = LoggedItem & { removed: boolean; original: boolean };
type ExpandField = "kg" | "reps" | "sets";

export function WorkoutTodayClient({
  cycles,
  dayNumber,
  cycleNumber,
  initialIntensity,
  alreadyDone,
  initialMemo,
  initialItems,
  completedAtLabel,
  completedToday = false,
  todayStatus = null,
  pending = false,
  feedbackLocked = false,
}: {
  cycles: WorkoutCycles;
  dayNumber: number;
  cycleNumber: number;
  initialIntensity: Intensity;
  alreadyDone: boolean;
  initialMemo: string | null;
  initialItems: LoggedItem[]; // 既存ログの実績(あれば)
  completedAtLabel: string | null;
  completedToday?: boolean; // 細2: 今日(JST)に既に記録済み
  todayStatus?: "done" | "rest_done" | "skipped" | null;
  pending?: boolean; // 点6: 再配布予告(次の周から切替)
  feedbackLocked?: boolean; // 点7: のりコメント後は編集ロック
}) {
  const router = useRouter();
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  // 細11: フォーム動画ライトボックス
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  // 決A: 編集完了で確定した編集内容(未保存・null=編集なし)。保存は「今日のトレ完了」で。
  const [editedItems, setEditedItems] = useState<LoggedItem[] | null>(null);
  const [editBaseline, setEditBaseline] = useState<EditItem[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false); // 点3
  const [expanded, setExpanded] = useState<{ i: number; field: ExpandField } | null>(null); // 点5
  const [invalidIdx, setInvalidIdx] = useState<number[]>([]); // 決B
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const dayMenu = resolveDayMenu(cycles, intensity, dayNumber);
  const isRest = dayMenu?.種別 === "休息";
  const isPersonal = dayMenu?.種別 === "パーソナル";
  const original = (dayMenu?.種目 ?? []).filter((e) => e.種目名);
  const dayLabel = dayMenu?.日 ?? `${dayNumber}日目`;
  // 原本値(点5の脚注・変更判定用)。原本にkgは無い(=常にnull)。
  const origByName = new Map<string, { reps: number | null; sets: number | null }>();
  for (const e of original) {
    const rs = parseRepsSets(e.回数);
    origByName.set(e.種目名, { reps: rs.reps, sets: rs.sets });
  }

  // 細12: ヒーロー2行目=メニュー名。「◯日目」だけ(上段と重複)なら部位ラベルへ。
  const partsLabel = (() => {
    const t = getExerciseTarget(original.flatMap((e) => e.主部位 ?? []));
    return t && t !== "全身" ? `${t}の日` : null;
  })();
  // M8 デイヒーロー: cap「今日のトレーニング ・ ◯周目」/ title「◯日目 ・ ◯◯の日」
  const titleSuffix = isRest
    ? "休養日"
    : isPersonal
      ? "パーソナル指導日"
      : dayLabel !== `${dayNumber}日目`
        ? dayLabel
        : partsLabel;
  const heroTitleText = titleSuffix
    ? `${dayNumber}日目 ・ ${titleSuffix}`
    : `${dayNumber}日目`;
  // 点6: 再配布予告「あと◯日」= いまの周の残り日数(総日数−現在日+1)
  const totalDays = dayCount(cycles, intensity) || 7;
  const daysLeft = Math.max(1, totalDays - dayNumber + 1);

  const [items, setItems] = useState<EditItem[]>([]);

  function buildInitial(): EditItem[] {
    if (initialItems.length > 0) {
      return initialItems.map((it) => ({ ...it, removed: false, original: it.source === "original" }));
    }
    return original.map((e) => {
      const rs = parseRepsSets(e.回数);
      return {
        exerciseName: e.種目名,
        source: "original" as const,
        weightKg: null,
        reps: rs.reps,
        sets: rs.sets,
        removed: false,
        original: true,
      };
    });
  }
  function fromLogged(logged: LoggedItem[]): EditItem[] {
    return logged.map((it) => ({ ...it, removed: false, original: it.source === "original" }));
  }
  function toLogged(list: EditItem[]): LoggedItem[] {
    return list
      .filter((it) => !it.removed)
      .map(({ exerciseName, source, weightKg, reps, sets }) => ({
        exerciseName,
        source,
        weightKg,
        reps,
        sets,
      }));
  }

  function enterEdit() {
    const base = editedItems ? fromLogged(editedItems) : buildInitial();
    setItems(base);
    setEditBaseline(base);
    setMode("edit");
    setError(null);
    setExpanded(null);
    setInvalidIdx([]);
    setValidationMsg(null);
  }
  function exitEditToView() {
    setMode("view");
    setConfirmDiscard(false);
    setExpanded(null);
    setInvalidIdx([]);
    setValidationMsg(null);
  }
  // 決B: 追加種目は回数≥1かつセット≥1が必須。違反 index を返す。
  function validateAdded(list: EditItem[]): number[] {
    const bad: number[] = [];
    list.forEach((it, i) => {
      if (it.removed || it.source !== "added") return;
      if (!(it.reps != null && it.reps >= 1 && it.sets != null && it.sets >= 1)) bad.push(i);
    });
    return bad;
  }
  function confirmEdit() {
    const bad = validateAdded(items);
    if (bad.length > 0) {
      setInvalidIdx(bad);
      setValidationMsg("追加した種目は、回数とセット数を入れてください");
      if (typeof document !== "undefined") {
        document.getElementById(`edit-item-${bad[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setEditedItems(toLogged(items));
    exitEditToView();
  }
  function cancelEdit() {
    if (editBaseline && JSON.stringify(items) !== JSON.stringify(editBaseline)) {
      setConfirmDiscard(true);
    } else {
      exitEditToView();
    }
  }

  function patch(i: number, p: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
    setInvalidIdx((prev) => prev.filter((x) => x !== i));
    setValidationMsg(null);
  }
  // 点4: 種目追加はボトムシート(検索→動画候補)
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  function addItem(name: string) {
    const v = name.trim();
    if (!v) return;
    setItems((prev) => [
      ...prev,
      { exerciseName: v, source: "added", weightKg: null, reps: null, sets: null, removed: false, original: false },
    ]);
    setAddSheetOpen(false);
  }

  async function save(status: "done" | "rest_done" | "skipped") {
    setError(null);
    setBusy(true);
    try {
      let payloadItems: LoggedItem[] = [];
      if (status === "done") {
        // 決A: 編集済みがあればそれを保存、なければ原本どおり(数値未指定)。
        payloadItems =
          editedItems ??
          original.map((e) => ({
            exerciseName: e.種目名,
            source: "original" as const,
            weightKg: null,
            reps: null,
            sets: null,
          }));
      }
      const r = await completeWorkoutDay({
        dayNumber,
        cycleNumber,
        intensity,
        status,
        memo,
        items: payloadItems,
      });
      if (!r.ok) throw new Error(r.message);
      router.replace(status === "skipped" ? "/workout/today" : "/workout/today?done=1");
      router.refresh();
    } catch (e) {
      // 点16: 生エラー(英語/内部ID)は見せない。console に残し、人の言葉に変換。
      console.warn("[workout] save failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  // 細2: 今日スキップ済み → 記録できないロック表示(次は明日から)
  if (completedToday && todayStatus === "skipped") {
    return (
      <div className="space-y-4">
        <div className="rounded-[14px] border border-[#cfe3d6] bg-gradient-to-br from-[#e8f3ec] to-[#fffbe6] px-[13px] py-[11px]">
          <div className="text-[9.5px] font-extrabold text-[#a5631f]">
            今日のトレーニング ・ {cycleNumber}周目
          </div>
          <div className="mt-0.5 text-[16px] font-extrabold text-[#2b2620]">今日はお休み</div>
        </div>
        <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-6 text-center">
          <p className="text-[13px] leading-relaxed text-[#5b5344]">
            今日はこの日をとばしました。次のトレーニングは明日からです。
          </p>
          <Link
            href="/workout/history"
            className="mt-3 inline-block text-[12px] font-bold text-[#4a875b]"
          >
            履歴を見る →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* デイヒーロー(M8 .dayhero転写: 淡色グラデ+茶cap+濃い文字) */}
      <div className="rounded-[14px] border border-[#cfe3d6] bg-gradient-to-br from-[#e8f3ec] to-[#fffbe6] px-[13px] py-[11px]">
        <div className="text-[9.5px] font-extrabold text-[#a5631f]">
          今日のトレーニング ・ {cycleNumber}周目
        </div>
        <div className="mt-0.5 text-[16px] font-extrabold text-[#2b2620]">{heroTitleText}</div>
      </div>

      {/* 点6: 再配布予告バッジ(M14) */}
      {pending && !feedbackLocked && (
        <div className="truncate rounded-xl border border-[#f0e2b8] bg-[#fffbeb] px-3.5 py-2.5 text-[11.5px] font-bold text-[#8a6d1a]">
          新しいメニューが届いています（あと{daysLeft}日で切替）
        </div>
      )}

      {alreadyDone && mode === "view" && (
        <div className="rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-2.5 text-[12px] font-bold text-[#34603f]">
          {feedbackLocked
            ? `✓ 今日のトレは完了済み${completedAtLabel ? `・${completedAtLabel}` : ""}`
            : `✓ 今日のトレは完了済み${completedAtLabel ? `・${completedAtLabel}` : ""}（内容を直せます）`}
        </div>
      )}

      {isRest || isPersonal ? (
        <div className="rounded-2xl border border-[#cfe0d4] bg-[#fbfdfc] px-4 py-5 text-center">
          <p className="text-[13px] leading-relaxed text-[#5b5344]">
            {isRest
              ? "今日は休養日です。しっかり回復させましょう。"
              : "今日は外部パーソナル指導の日です。"}
          </p>
        </div>
      ) : (
        <>
          {/* 強度 (M8 .stg転写: トラック無し・枠付きピル・選択=#34603f塗り) */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">強度</div>
            <div className="flex gap-1.5">
              {(["small", "medium", "large"] as Intensity[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  disabled={mode === "edit"}
                  onClick={() => {
                    setIntensity(iv);
                    // 強度を変えると編集内容(旧強度基準)は破棄して原本へ戻す
                    setEditedItems(null);
                  }}
                  className={`flex-1 rounded-[9px] border-[1.5px] py-1.5 text-[11.5px] font-extrabold transition-colors ${
                    intensity === iv
                      ? "border-[#34603f] bg-[#34603f] text-white"
                      : "border-[#e7dcc9] bg-[#fffdf8] text-[#6a6256]"
                  } ${mode === "edit" ? "opacity-50" : ""}`}
                >
                  {INTENSITY_LABEL[iv]}
                </button>
              ))}
            </div>
          </div>

          {/* 決A: 編集済み(未保存)の注記 */}
          {mode === "view" && editedItems && (
            <div className="rounded-lg border border-[#e7dcc9] bg-[#fbf7ec] px-3 py-2 text-[11px] font-bold text-[#8a6d1a]">
              編集済み・「今日のトレ完了」を押すまで保存されません
            </div>
          )}

          {mode === "view" ? (
            <ViewList
              original={original}
              loggedItems={initialItems}
              overrideItems={editedItems}
              intensityLabel={INTENSITY_LABEL[intensity]}
              onPlay={(url, name) => setLightbox({ url, name })}
            />
          ) : (
            <EditList
              items={items}
              original={original}
              origByName={origByName}
              intensityLabel={INTENSITY_LABEL[intensity]}
              invalidIdx={invalidIdx}
              expanded={expanded}
              onExpand={setExpanded}
              onPatch={patch}
              onOpenAdd={() => setAddSheetOpen(true)}
              onPlay={(url, name) => setLightbox({ url, name })}
            />
          )}

          {/* 決B: バリデーション注意(編集中) */}
          {mode === "edit" && validationMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f0c9c0] bg-[#fdeee9] px-3 py-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2693f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="flex-1 text-[12px] text-[#8a4b32]">{validationMsg}</span>
            </div>
          )}

          {/* 細13: 今日はやらない/メニュー全体は本体(通常領域)へ */}
          {mode === "view" && !alreadyDone && !feedbackLocked && (
            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              className="mt-1 block w-full text-center text-[12px] text-[#a59b8c]"
            >
              今日はやらない →
            </button>
          )}
          {mode === "view" && (
            <Link
              href="/workout"
              className="block text-center text-[11px] text-[#6a6256]"
            >
              メニュー全体を見る →
            </Link>
          )}
        </>
      )}

      {/* メモ */}
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">
          ひとことメモ（任意）
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="今日の調子など"
          className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
      </div>

      {/* 点16: 生エラーを撤去。食事(細7)と同じ SVG + 人の言葉 + もう一度試す。 */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#f0c9c0] bg-[#fdeee9] px-3 py-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2693f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1 text-[12px] text-[#8a4b32]">{error}</span>
          <button
            type="button"
            onClick={() => save("done")}
            disabled={busy}
            className="flex-shrink-0 rounded-lg bg-[#4a875b] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            もう一度試す
          </button>
        </div>
      )}

      {/* 下部固定バー */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[460px] space-y-1.5">
          {confirmDiscard ? (
            // 点3: 編集破棄の確認
            <div className="rounded-xl border border-[#f0e2b8] bg-[#fffbeb] p-3">
              <p className="text-[12px] leading-snug text-[#8a6d1a]">
                編集した内容を破棄しますか？（「編集完了」を押すまで保存されません）
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={exitEditToView}
                  className="flex-1 rounded-lg border border-[#e7dcc9] bg-white py-2 text-[12px] font-bold text-[#6a6256]"
                >
                  破棄してやめる
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="flex-1 rounded-lg bg-[#8a6d1a] py-2 text-[12px] font-bold text-white"
                >
                  編集に戻る
                </button>
              </div>
            </div>
          ) : mode === "edit" ? (
            // 決A: 編集をやめる(点3) + ✓編集完了(DBに書かずviewへ)
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border-2 border-[#d8cdba] px-4 py-3 text-[13px] font-bold text-[#6a6256]"
              >
                編集をやめる
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                className="flex-1 rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white"
              >
                ✓ 編集完了
              </button>
            </div>
          ) : confirmSkip ? (
            <div className="rounded-xl border border-[#f0e2b8] bg-[#fffbeb] p-3">
              <p className="text-[12px] leading-snug text-[#8a6d1a]">
                {dayNumber}日目をとばして次の日から始めますか？（この日は「未実施」として記録に残ります）
                <br />
                のりはこの記録も見て、あなたに合った声かけをします。
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => save("skipped")}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-[#8a6d1a] py-2 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  とばす
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSkip(false)}
                  className="flex-1 rounded-lg border border-[#e7dcc9] py-2 text-[12px] font-bold text-[#6a6256]"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : feedbackLocked ? (
            // 点7: のりコメント後は編集導線を出さない
            <p className="rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-3 text-center text-[12px] font-bold text-[#34603f]">
              のりのコメントが届いたため、この日の記録は確定されています
            </p>
          ) : isRest || isPersonal ? (
            <button
              type="button"
              onClick={() => save(isRest ? "rest_done" : "done")}
              disabled={busy}
              className="w-full rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "保存中…" : isRest ? "✓ 今日は休んだ（完了）" : "✓ 完了"}
            </button>
          ) : (
            // 細13: 編集する(枠) + ✓完了(緑) の横並び2ボタン
            <div className="flex gap-2">
              <button
                type="button"
                onClick={enterEdit}
                className="rounded-xl border-2 border-[#4a875b] px-4 py-3 text-[13px] font-bold text-[#4a875b]"
              >
                編集する
              </button>
              <button
                type="button"
                onClick={() => save("done")}
                disabled={busy}
                className="flex-1 rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "保存中…" : alreadyDone ? "✓ 内容を上書き保存" : "✓ 今日のトレ完了"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 点4: 種目追加ボトムシート(検索→動画候補) */}
      <BottomSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="種目を追加">
        <AddExerciseSheet
          existing={items.map((it) => it.exerciseName)}
          onAdd={addItem}
        />
      </BottomSheet>

      {/* 細11: フォーム動画ライトボックス */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <VimeoEmbed url={lightbox.url} />
            <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
              <span className="text-[13px] font-bold">{lightbox.name}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="text-lg text-zinc-400 hover:text-white"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// M8 .val 表記: 「14kg ・ 12回 × 3」
function numText(it?: LoggedItem | null): string | null {
  if (!it || (it.weightKg == null && it.reps == null && it.sets == null)) return null;
  const head = [
    it.weightKg != null ? `${it.weightKg}kg` : null,
    it.reps != null ? `${it.reps}回` : null,
  ]
    .filter(Boolean)
    .join(" ・ ");
  const tail = it.sets != null ? `${head ? " " : ""}× ${it.sets}` : "";
  return head + tail || null;
}

// 表示リスト(readonly)。M8 .list転写: 1枚カード内を .lh見出し + .ex行区切りで。
function ViewList({
  original,
  loggedItems,
  overrideItems,
  intensityLabel,
  onPlay,
}: {
  original: Exercise[];
  loggedItems: LoggedItem[];
  overrideItems: LoggedItem[] | null; // 決A: 編集済み(未保存)があればこれを表示
  intensityLabel: string;
  onPlay: (url: string, name: string) => void;
}) {
  const videoByName = new Map<string, string>();
  for (const e of original) {
    const u = resolveExerciseVideo(e);
    if (u) videoByName.set(e.種目名, u);
  }
  const origText = (e: Exercise) => {
    const rs = parseRepsSets(e.回数);
    return rs.reps != null ? `${rs.reps}回${rs.sets != null ? ` × ${rs.sets}` : ""}` : cleanReps(e.回数);
  };

  // 表示する行を作る(編集済み優先)
  type Row = { name: string; source: "original" | "added"; videoUrl: string | null; val: string };
  let rows: Row[];
  if (overrideItems) {
    const origMap = new Map(original.map((e) => [e.種目名, e]));
    rows = overrideItems.map((it) => ({
      name: it.exerciseName,
      source: it.source,
      videoUrl: videoByName.get(it.exerciseName) ?? lookupVideoByName(it.exerciseName),
      val: numText(it) ?? (origMap.has(it.exerciseName) ? origText(origMap.get(it.exerciseName)!) : "記録あり"),
    }));
  } else {
    const logByName = new Map(loggedItems.map((it) => [it.exerciseName, it]));
    const added = loggedItems.filter((it) => it.source === "added");
    rows = [
      ...original.map((e) => ({
        name: e.種目名,
        source: "original" as const,
        videoUrl: videoByName.get(e.種目名) ?? null,
        val: numText(logByName.get(e.種目名)) ?? origText(e),
      })),
      ...added.map((it) => ({
        name: it.exerciseName,
        source: "added" as const,
        videoUrl: lookupVideoByName(it.exerciseName),
        val: numText(it) ?? "記録あり",
      })),
    ];
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#e7dcc9] p-6 text-center text-[12px] text-[#a59b8c]">
        この日の種目は設定されていません。
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-[13px] border border-[#e7dcc9] bg-white">
      {/* 点8: リスト見出し(.lh・選択強度に追随) */}
      <div className="border-b border-[#f3eddf] px-3 py-2 text-[10px] font-extrabold text-[#6a6256]">
        今日の内容（{intensityLabel}強度）
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-[#f3eddf] px-3 py-2.5 last:border-b-0"
        >
          {r.videoUrl ? (
            <PlayBtn onClick={() => onPlay(r.videoUrl!, cleanExerciseName(r.name))} />
          ) : r.source === "added" ? (
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
              <span className="rounded bg-[#4a875b] px-1.5 py-0.5 text-[9px] font-bold text-white">
                追加
              </span>
            </span>
          ) : (
            <span className="h-11 w-11 flex-shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">
            {cleanExerciseName(r.name)}
          </div>
          <span className="whitespace-nowrap text-[11px] font-bold text-[#6a6256]">{r.val}</span>
        </div>
      ))}
    </div>
  );
}

// 編集リスト(点5: 数値チップ→展開ステッパー)
function EditList({
  items,
  original,
  origByName,
  intensityLabel,
  invalidIdx,
  expanded,
  onExpand,
  onPatch,
  onOpenAdd,
  onPlay,
}: {
  items: EditItem[];
  original: Exercise[];
  origByName: Map<string, { reps: number | null; sets: number | null }>;
  intensityLabel: string;
  invalidIdx: number[];
  expanded: { i: number; field: ExpandField } | null;
  onExpand: (v: { i: number; field: ExpandField } | null) => void;
  onPatch: (i: number, p: Partial<EditItem>) => void;
  onOpenAdd: () => void;
  onPlay: (url: string, name: string) => void;
}) {
  const videoByName = new Map<string, string>();
  for (const e of original) {
    const u = resolveExerciseVideo(e);
    if (u) videoByName.set(e.種目名, u);
  }
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        // 追加種目はライブラリ名から動画解決(点4で候補選択したもの)
        const videoUrl = videoByName.get(it.exerciseName) ?? lookupVideoByName(it.exerciseName);
        const orig = origByName.get(it.exerciseName) ?? null;
        const invalid = invalidIdx.includes(i);
        return (
          <div
            id={`edit-item-${i}`}
            key={i}
            className={`rounded-xl border-[1.5px] px-3 py-2.5 ${
              invalid
                ? "border-[#e0857a] bg-[#fdeee9]"
                : it.removed
                  ? "border-[#e7dcc9] bg-[#f5f1e8] opacity-70"
                  : it.source === "added"
                    ? "border-[#d7e6db] bg-[#eef5f0]"
                    : "border-[#e7dcc9] bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex-1 text-[13px] font-bold ${it.removed ? "text-[#a59b8c] line-through" : "text-[#2b2620]"}`}
              >
                {cleanExerciseName(it.exerciseName)}
                {it.source === "added" && (
                  <span className="ml-1.5 rounded bg-[#4a875b] px-1 py-0.5 text-[8px] text-white">
                    追加
                  </span>
                )}
              </span>
              {videoUrl && !it.removed && (
                <PlayBtn onClick={() => onPlay(videoUrl, cleanExerciseName(it.exerciseName))} />
              )}
              <button
                type="button"
                onClick={() => onPatch(i, { removed: !it.removed })}
                className="flex h-9 items-center rounded-full border border-[#d8cdba] px-3 text-[11px] font-bold text-[#a59b8c]"
              >
                {it.removed ? "戻す" : "はずす"}
              </button>
            </div>
            {!it.removed && (
              <div className="mt-2">
                {/* 点5: 数値チップ(タップで展開) */}
                <div className="flex gap-2">
                  {(
                    [
                      { field: "kg" as const, label: "kg", val: it.weightKg, orig: null as number | null },
                      { field: "reps" as const, label: "回", val: it.reps, orig: orig?.reps ?? null },
                      { field: "sets" as const, label: "セット", val: it.sets, orig: orig?.sets ?? null },
                    ]
                  ).map((c) => {
                    const changed =
                      it.source === "original" &&
                      c.val !== c.orig &&
                      !(c.val == null && c.orig == null);
                    const isOpen = expanded?.i === i && expanded.field === c.field;
                    return (
                      <button
                        key={c.field}
                        type="button"
                        onClick={() => onExpand(isOpen ? null : { i, field: c.field })}
                        className={`relative flex-1 rounded-[9px] border-[1.5px] px-1 py-1.5 text-center ${
                          isOpen
                            ? "border-[#34603f] bg-[#f0f7f2]"
                            : changed
                              ? "border-[#4a875b] bg-[#f0f7f2]"
                              : "border-[#e7dcc9] bg-[#f9f5ed]"
                        }`}
                      >
                        <div className="text-[8px] font-bold text-[#a59b8c]">{c.label}</div>
                        <div className="text-[14px] font-extrabold text-[#2b2620]">{c.val ?? "—"}</div>
                        {changed && (
                          <span className="absolute -top-2 right-1 rounded-full bg-[#4a875b] px-1.5 text-[7.5px] font-bold text-white">
                            変更
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 展開ステッパー */}
                {expanded?.i === i && (
                  <BigStepper
                    field={expanded.field}
                    value={
                      expanded.field === "kg" ? it.weightKg : expanded.field === "reps" ? it.reps : it.sets
                    }
                    step={expanded.field === "kg" ? 2.5 : 1}
                    onChange={(v) =>
                      onPatch(i, {
                        weightKg: expanded.field === "kg" ? v : it.weightKg,
                        reps: expanded.field === "reps" ? v : it.reps,
                        sets: expanded.field === "sets" ? v : it.sets,
                      })
                    }
                    footnote={footnoteFor(expanded.field, it, orig, intensityLabel)}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 点4+細15: 種目追加はボトムシート(検索→動画候補)を開く緑ボタン */}
      <button
        type="button"
        onClick={onOpenAdd}
        className="mt-1 flex w-full items-center justify-center rounded-xl bg-[#4a875b] py-3 text-[13px] font-bold text-white"
      >
        ＋ 種目を追加
      </button>
    </div>
  );
}

// 点4: 種目追加シート(M8-⑤/M9-④)。検索→動画ライブラリ候補(▶)→無ければ自由入力。
function AddExerciseSheet({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const existingSet = new Set(existing);
  // video-master から名前部分一致で候補(動画あり)。重複/既追加は除外。
  const candidates =
    query.length === 0
      ? []
      : listExercisesWithVideo()
          .filter((e) => e.確定代表名.includes(query) && !existingSet.has(e.確定代表名))
          .slice(0, 12);
  const exactHit = candidates.some((c) => c.確定代表名 === query);

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="種目名で検索（例: サ → サイドレイズ）"
        className="h-11 w-full rounded-lg border border-[#e7dcc9] bg-white px-3 text-[14px] focus:border-[#4a875b] focus:outline-none"
      />

      {query.length === 0 ? (
        <p className="px-1 py-4 text-center text-[12px] text-[#a59b8c]">
          種目名を入力すると、動画のある種目が候補に出ます。
        </p>
      ) : (
        <div className="space-y-1.5">
          {candidates.map((c) => (
            <button
              key={c.確定代表名}
              type="button"
              onClick={() => onAdd(c.確定代表名)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5 text-left"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f3ec]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#34603f">
                  <polygon points="6 4 20 12 6 20" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">
                {cleanExerciseName(c.確定代表名)}
              </span>
              <span className="flex-shrink-0 text-[10px] font-bold text-[#4a875b]">動画あり</span>
            </button>
          ))}
          {/* 候補になくても自由入力で追加(動画なし) */}
          {!exactHit && (
            <button
              type="button"
              onClick={() => onAdd(query)}
              className="flex w-full items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#4a875b] bg-[#f0f7f2] py-2.5 text-[12.5px] font-bold text-[#34603f]"
            >
              ＋「{query}」を追加する
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 点5: 展開ステッパーの脚注(原本値・強度)
function footnoteFor(
  field: ExpandField,
  it: EditItem,
  orig: { reps: number | null; sets: number | null } | null,
  intensityLabel: string
): string {
  if (it.source === "added") return "新しく追加した種目";
  if (field === "kg") return "原本の指定なし（自重でOK）";
  const ov = field === "reps" ? orig?.reps : orig?.sets;
  const unit = field === "reps" ? "回" : "セット";
  return ov != null ? `原本値 ${ov}${unit}（${intensityLabel}強度）` : "原本の指定なし";
}

// 細11+PR-T2: フォーム動画 ▶ ボタン。M8 .vplay転写(薄緑円+緑▶)・タップは44px維持(ルール20)
function PlayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="フォーム動画を見る"
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f3ec]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#34603f">
        <polygon points="6 4 20 12 6 20" />
      </svg>
    </button>
  );
}

// 点5: 展開ステッパー(M8 .stepperbig・44px・0→未入力)
function BigStepper({
  field,
  value,
  step,
  onChange,
  footnote,
}: {
  field: ExpandField;
  value: number | null;
  step: number;
  onChange: (v: number | null) => void;
  footnote: string;
}) {
  const dec = () => {
    const n = Math.round(((value ?? 0) - step) * 10) / 10;
    onChange(n <= 0 ? null : n); // 決B: 0まで下げたら未入力
  };
  const inc = () => onChange(Math.round(((value ?? 0) + step) * 10) / 10);
  const unit = field === "kg" ? "kg" : field === "reps" ? "回" : "セット";
  return (
    <div className="mt-2 rounded-[11px] border-[1.5px] border-[#4a875b] bg-[#f9f5ed] p-2.5">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="減らす"
          onClick={dec}
          className="flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#cfe0d4] bg-[#eef5f0] text-[18px] font-bold text-[#34603f]"
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={value ?? ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") return onChange(null);
              const n = Number(v);
              onChange(Number.isFinite(n) && n > 0 ? n : null);
            }}
            className="h-11 w-20 rounded-[9px] border border-[#cfe0d4] bg-white text-center text-[19px] font-extrabold text-[#2b2620] focus:outline-none"
          />
          <span className="text-[10px] font-bold text-[#a59b8c]">{unit}</span>
        </div>
        <button
          type="button"
          aria-label="増やす"
          onClick={inc}
          className="flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#cfe0d4] bg-[#eef5f0] text-[18px] font-bold text-[#34603f]"
        >
          ＋
        </button>
      </div>
      <div className="mt-1.5 text-center text-[9px] text-[#a59b8c]">{footnote}</div>
    </div>
  );
}
