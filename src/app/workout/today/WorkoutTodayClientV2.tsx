"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkoutCycles, Exercise } from "@/lib/workout/types";
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
 * 実施記録 V2（2026-07-14・きよむ仮反映プレビュー / preview.ts でゲート）。
 * 承認済みモック(workout-states.html 他)を実装。既存の実施記録は温存し、preview の人だけこれを見る。
 *  - H2ヒーロー(リング・開いたら0→現在位置アニメ)。日数=今日の予定で固定・テーマだけ選択で変化。
 *  - 横カード(全日・自動で今日の予定へスクロール)。休養/パーソナル日でも別の日を選べる。
 *  - P2再生ボタン(黒立体・小)。スキップ=「今日は休養日にする」(rest_done)。本人休養は「やっぱりやる」で取消。
 *  - のり予定の休養日/パーソナルは取消無し・専用文言(A/B)。編集(種目追加・数値)は既存と同等。
 * 進行(current_day)は「今日の予定日=dayNumber」で前進(枠は今日・中身だけ差し替え)。
 * ※予定vs実施・本人休養の"区別記録"の正式な列追加は全員公開の前に別途(このプレビューは既存completeWorkoutDayで動作)。
 */

type EditItem = LoggedItem & { removed: boolean; original: boolean };
type ExpandField = "kg" | "reps" | "sets";

function dayTheme(cycles: WorkoutCycles, intensity: Intensity, day: number): {
  label: string;
  kind: "train" | "rest" | "personal";
  exCount: number;
} {
  const dm = resolveDayMenu(cycles, intensity, day);
  if (!dm) return { label: "—", kind: "train", exCount: 0 };
  if (dm.種別 === "休息") return { label: "休養日", kind: "rest", exCount: 0 };
  if (dm.種別 === "パーソナル") return { label: "パーソナル", kind: "personal", exCount: 0 };
  const ex = (dm.種目 ?? []).filter((e) => e.種目名);
  const t = getExerciseTarget(ex.flatMap((e) => e.主部位 ?? []));
  const theme = dm.日 && dm.日 !== `${day}日目` ? dm.日 : t && t !== "全身" ? `${t}の日` : "トレーニング";
  return { label: theme, kind: "train", exCount: ex.length };
}

export function WorkoutTodayClientV2({
  cycles,
  dayNumber,
  cycleNumber,
  initialIntensity,
  alreadyDone,
  initialMemo,
  completedAtLabel,
  feedbackLocked = false,
}: {
  cycles: WorkoutCycles;
  dayNumber: number;
  cycleNumber: number;
  initialIntensity: Intensity;
  alreadyDone: boolean;
  initialMemo: string | null;
  completedAtLabel: string | null;
  feedbackLocked?: boolean;
}) {
  const router = useRouter();
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [selectedDay, setSelectedDay] = useState<number>(dayNumber);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [selfRest, setSelfRest] = useState(false);
  const [drawn, setDrawn] = useState(false);
  // 編集(既存と同等): editedItems=未保存の編集内容 / mode / items=編集中の作業リスト
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editedItems, setEditedItems] = useState<LoggedItem[] | null>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [editBaseline, setEditBaseline] = useState<EditItem[] | null>(null);
  const [expanded, setExpanded] = useState<{ i: number; field: ExpandField } | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [invalidIdx, setInvalidIdx] = useState<number[]>([]);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const total = dayCount(cycles, intensity) || 7;
  const cardsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardsRef.current?.querySelector<HTMLElement>(`[data-day="${dayNumber}"]`);
    if (el && cardsRef.current) cardsRef.current.scrollLeft = Math.max(0, el.offsetLeft - 12);
  }, [dayNumber]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const activeMenu = resolveDayMenu(cycles, intensity, selectedDay);
  const isRestDay = activeMenu?.種別 === "休息";
  const isPersonalDay = activeMenu?.種別 === "パーソナル";
  const original = (activeMenu?.種目 ?? []).filter((e) => e.種目名);
  const scheduledTheme = dayTheme(cycles, intensity, dayNumber).label;
  const activeTheme = dayTheme(cycles, intensity, selectedDay).label;

  const R = 16, C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, dayNumber / total));
  const offset = drawn ? C * (1 - frac) : C;

  const videoOf = (name: string, orig?: Exercise) =>
    (orig ? resolveExerciseVideo(orig) : null) ?? lookupVideoByName(name);

  // 日/強度を変えたら編集状態はリセット(別の日の内容になるため)
  function changeDay(d: number) {
    setSelectedDay(d);
    setSelfRest(false);
    setEditedItems(null);
    setMode("view");
    setExpanded(null);
  }
  function changeIntensity(iv: Intensity) {
    setIntensity(iv);
    setEditedItems(null);
    setMode("view");
    setExpanded(null);
  }

  // ---- 編集ヘルパ(既存 WorkoutTodayClient と同等) ----
  const origByName = new Map<string, { reps: number | null; sets: number | null }>();
  for (const e of original) {
    const rs = parseRepsSets(e.回数);
    origByName.set(e.種目名, { reps: rs.reps, sets: rs.sets });
  }
  function buildInitial(): EditItem[] {
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
  function fromLogged(l: LoggedItem[]): EditItem[] {
    return l.map((it) => ({ ...it, removed: false, original: it.source === "original" }));
  }
  function toLogged(list: EditItem[]): LoggedItem[] {
    return list
      .filter((it) => !it.removed)
      .map(({ exerciseName, source, weightKg, reps, sets }) => ({ exerciseName, source, weightKg, reps, sets }));
  }
  function enterEdit() {
    const base = editedItems ? fromLogged(editedItems) : buildInitial();
    setItems(base);
    setEditBaseline(base);
    setMode("edit");
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
      return;
    }
    setEditedItems(toLogged(items));
    exitEditToView();
  }
  function cancelEdit() {
    if (editBaseline && JSON.stringify(items) !== JSON.stringify(editBaseline)) setConfirmDiscard(true);
    else exitEditToView();
  }
  function patch(i: number, p: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
    setInvalidIdx((prev) => prev.filter((x) => x !== i));
    setValidationMsg(null);
  }
  function addItem(name: string) {
    const v = name.trim();
    if (!v) return;
    if (mode === "edit") {
      setItems((prev) => [
        ...prev,
        { exerciseName: v, source: "added", weightKg: null, reps: null, sets: null, removed: false, original: false },
      ]);
    } else {
      setEditedItems((prev) => [
        ...(prev ?? toLogged(buildInitial())),
        { exerciseName: v, source: "added", weightKg: null, reps: null, sets: null },
      ]);
    }
    setAddSheetOpen(false);
  }

  async function save(status: "done" | "rest_done") {
    setError(null);
    setBusy(true);
    try {
      let payloadItems: LoggedItem[] = [];
      if (status === "done") {
        payloadItems =
          editedItems ??
          original.map((e) => {
            const rs = parseRepsSets(e.回数);
            return { exerciseName: e.種目名, source: "original" as const, weightKg: null, reps: rs.reps, sets: rs.sets };
          });
        const badAdded = payloadItems.some(
          (it) => it.source === "added" && !(it.reps != null && it.reps >= 1 && it.sets != null && it.sets >= 1),
        );
        if (badAdded) {
          setBusy(false);
          const base = fromLogged(editedItems ?? toLogged(buildInitial()));
          setItems(base);
          setEditBaseline(base);
          setMode("edit");
          setInvalidIdx(validateAdded(base));
          setValidationMsg("追加した種目は、回数とセット数を入れてください");
          return;
        }
      }
      const r = await completeWorkoutDay({
        dayNumber,
        cycleNumber,
        intensity,
        status,
        memo,
        items: payloadItems,
        // 区別記録: done の時だけ「実施した日」を渡す(予定と違えば差分保存)。rest_done は本人休養フラグ。
        performedDayNumber: status === "done" ? selectedDay : null,
        isSelfRest: status === "rest_done" && selfRest,
      });
      if (!r.ok) throw new Error(r.message);
      router.replace("/workout/today?done=1");
      router.refresh();
    } catch (e) {
      console.warn("[workout v2] save failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  const showTraining = !selfRest && !isRestDay && !isPersonalDay;

  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed]">
      <div className="mx-auto max-w-[460px] px-4 py-4 pb-[190px]">
        {/* H2ヒーロー */}
        <div className="mb-3 flex items-center gap-2.5 rounded-[13px] border border-[#cfe3d6] bg-gradient-to-br from-[#e8f3ec] to-[#fffbe6] px-3 py-2">
          <div className="relative h-11 w-11 flex-shrink-0">
            <svg width="44" height="44" className="-rotate-90">
              <circle cx="22" cy="22" r={R} fill="none" stroke="#d3e2d8" strokeWidth="4.5" />
              <circle cx="22" cy="22" r={R} fill="none" stroke="#34603f" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.1s ease-out" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <b className="text-[13px] font-extrabold text-[#34603f]">{dayNumber}</b>
              <small className="text-[7px] text-[#6a6256]">/{total}日</small>
            </div>
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-[#a5631f]">今日のトレーニング ・ {cycleNumber}周目</div>
            <div className="mt-0.5 text-[15px] font-extrabold text-[#2b2620]">
              {dayNumber}日目 ・ {selfRest ? "休養（自分で設定）" : activeTheme}
            </div>
          </div>
        </div>

        {/* 強度(編集中は不可) */}
        <div className="mb-3 flex gap-1.5">
          {(["small", "medium", "large"] as Intensity[]).map((iv) => (
            <button
              key={iv}
              type="button"
              disabled={mode === "edit"}
              onClick={() => changeIntensity(iv)}
              className={`flex-1 rounded-[9px] border-[1.5px] py-1.5 text-[11.5px] font-extrabold transition-colors ${
                intensity === iv
                  ? "border-[#2e5638] bg-gradient-to-b from-[#3f7350] to-[#34603f] text-white shadow-[0_3px_7px_rgba(52,96,63,0.32)]"
                  : "border-[#e7dcc9] bg-[#fffdf8] text-[#6a6256]"
              } ${mode === "edit" ? "opacity-50" : ""}`}
            >
              {INTENSITY_LABEL[iv]}
            </button>
          ))}
        </div>

        {/* ラベル + 今日の予定(常時) */}
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[10.5px] font-extrabold text-[#6a6256]">今日やるメニューを選択</span>
          <span className="rounded-full border border-[#cfe3d6] bg-[#eef5f0] px-2.5 py-0.5 text-[9.5px] font-extrabold text-[#34603f]">
            今日の予定：{scheduledTheme}
          </span>
        </div>

        {/* 横カード */}
        <div ref={cardsRef} className="flex gap-2 overflow-x-auto pb-1.5 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
            const t = dayTheme(cycles, intensity, d);
            const on = d === selectedDay && !selfRest;
            const isToday = d === dayNumber;
            return (
              <button
                key={d}
                type="button"
                data-day={d}
                disabled={mode === "edit"}
                onClick={() => changeDay(d)}
                className={`relative flex-shrink-0 basis-[104px] rounded-[11px] border-[1.5px] px-1.5 py-2 text-center transition-colors ${
                  on ? "border-[#2e5638] bg-gradient-to-b from-[#f2f8f4] to-[#eaf3ec] shadow-[0_2px_6px_rgba(52,96,63,0.14)]" : "border-[#e7dcc9] bg-white"
                } ${mode === "edit" ? "opacity-50" : ""}`}
              >
                {isToday && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#ebc9a6] bg-[#fbf2dd] px-1.5 py-[1px] text-[7.5px] font-extrabold text-[#a5631f]">
                    今日の予定
                  </span>
                )}
                <div className="text-[10.5px] font-extrabold text-[#34603f]">{d}日目</div>
                <div className={`mt-0.5 text-[12px] font-extrabold ${t.kind === "rest" ? "text-[#a59b8c]" : "text-[#2b2620]"}`}>{t.label}</div>
                <div className="mt-0.5 text-[8.5px] text-[#a59b8c]">
                  {t.kind === "rest" ? "お休み" : t.kind === "personal" ? "指導日" : `${t.exCount}種目`}
                </div>
                {on && <span className="mt-1 inline-block rounded-full bg-[#4a875b] px-1.5 py-[1px] text-[7.5px] font-extrabold text-white">選択中</span>}
              </button>
            );
          })}
        </div>

        {/* 本体 */}
        {selfRest ? (
          <div className="mt-3">
            <div className="rounded-xl border border-[#e7dcc9] bg-white px-4 py-5 text-center text-[12.5px] leading-relaxed text-[#5b5344]">
              今日は<b className="text-[#34603f]">休養日</b>にしました。
              <br />
              しっかり回復させましょう。
            </div>
            <button type="button" onClick={() => setSelfRest(false)} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#4a875b] bg-white py-3 text-[13px] font-extrabold text-[#34603f]">
              ↩ やっぱり今日やる（休養を取り消す）
            </button>
          </div>
        ) : isRestDay ? (
          <div className="mt-3 rounded-xl border border-[#e7dcc9] bg-white px-4 py-5 text-center text-[12.5px] leading-relaxed text-[#5b5344]">
            今日は<b className="text-[#34603f]">休養日</b>です。しっかり回復させましょう。
            <span className="mt-1.5 block text-[11px] text-[#6a6256]">もし体を動かしたい時は、上から別の日のメニューを選べます。</span>
          </div>
        ) : isPersonalDay ? (
          <div className="mt-3 rounded-xl border border-[#e7dcc9] bg-white px-4 py-5 text-center text-[12.5px] leading-relaxed text-[#5b5344]">
            今日は<b className="text-[#34603f]">パーソナル指導の日</b>。
            <span className="mt-1.5 block text-[11px] text-[#6a6256]">行けない時は、上で別の日を選択してメニューを設定できます。</span>
          </div>
        ) : (
          <div className="mt-3">
            {alreadyDone && mode === "view" && (
              <div className="mb-2 rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-2.5 text-[12px] font-bold text-[#34603f]">
                ✓ 今日のトレは完了済み{completedAtLabel ? `・${completedAtLabel}` : ""}（内容を直せます）
              </div>
            )}
            {mode === "view" && editedItems && (
              <div className="mb-2 rounded-lg border border-[#e7dcc9] bg-[#fbf7ec] px-3 py-2 text-[11px] font-bold text-[#8a6d1a]">
                編集済み・「今日のトレ完了」を押すまで保存されません
              </div>
            )}
            {mode === "view" ? (
              <ViewList original={original} overrideItems={editedItems} intensityLabel={INTENSITY_LABEL[intensity]} theme={activeTheme} onPlay={(u, n) => setLightbox({ url: u, name: n })} videoOf={videoOf} />
            ) : (
              <EditList items={items} original={original} origByName={origByName} intensityLabel={INTENSITY_LABEL[intensity]} invalidIdx={invalidIdx} expanded={expanded} onExpand={setExpanded} onPatch={patch} onOpenAdd={() => setAddSheetOpen(true)} onPlay={(u, n) => setLightbox({ url: u, name: n })} videoOf={videoOf} />
            )}

            {mode === "view" && !feedbackLocked && (
              <button type="button" onClick={() => setAddSheetOpen(true)} className="mt-2.5 w-full rounded-xl border-[1.5px] border-[#cfe0d4] bg-white py-3 text-[13px] font-extrabold text-[#34603f]">
                ＋ 種目を追加
              </button>
            )}
            {mode === "edit" && validationMsg && (
              <div className="mt-2 rounded-lg border border-[#f0c9c0] bg-[#fdeee9] px-3 py-2.5 text-[12px] text-[#8a4b32]">{validationMsg}</div>
            )}
            {mode === "view" && !feedbackLocked && (
              <button type="button" onClick={() => setSelfRest(true)} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#d8cdba] bg-[#fbf8f1] py-2.5 text-[12.5px] font-extrabold text-[#8a7f6c]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a5936f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
                今日は休養日にする
              </button>
            )}
          </div>
        )}

        {/* メモ */}
        {showTraining && mode === "view" && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">ひとことメモ（任意）</div>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="今日の調子など" className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none" />
          </div>
        )}

        {error && <div className="mt-3 rounded-lg border border-[#f0c9c0] bg-[#fdeee9] px-3 py-2.5 text-[12px] text-[#8a4b32]">{error}</div>}
      </div>

      {/* 下部固定バー(ナビの上へ) */}
      <div className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur" style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-[460px]">
          {confirmDiscard ? (
            <div className="rounded-xl border border-[#f0e2b8] bg-[#fffbeb] p-3">
              <p className="text-[12px] leading-snug text-[#8a6d1a]">編集した内容を破棄しますか？</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={exitEditToView} className="flex-1 rounded-lg border border-[#e7dcc9] bg-white py-2 text-[12px] font-bold text-[#6a6256]">破棄してやめる</button>
                <button type="button" onClick={() => setConfirmDiscard(false)} className="flex-1 rounded-lg bg-[#8a6d1a] py-2 text-[12px] font-bold text-white">編集に戻る</button>
              </div>
            </div>
          ) : mode === "edit" ? (
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="rounded-xl border-2 border-[#d8cdba] px-4 py-3 text-[13px] font-bold text-[#6a6256]">編集をやめる</button>
              <button type="button" onClick={confirmEdit} className="btn3d flex-1 rounded-xl py-3 text-[14px] font-bold">✓ 編集完了</button>
            </div>
          ) : selfRest ? (
            <button type="button" onClick={() => save("rest_done")} disabled={busy} className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">{busy ? "保存中…" : "✓ 休養を記録"}</button>
          ) : isRestDay ? (
            <button type="button" onClick={() => save("rest_done")} disabled={busy} className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">{busy ? "保存中…" : "✓ 今日は休んだ（完了）"}</button>
          ) : isPersonalDay ? (
            <button type="button" onClick={() => save("done")} disabled={busy} className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">{busy ? "保存中…" : "✓ 完了"}</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={enterEdit} className="rounded-xl border-2 border-[#4a875b] px-4 py-3 text-[13px] font-bold text-[#4a875b]">編集する</button>
              <button type="button" onClick={() => save("done")} disabled={busy} className="btn3d flex-1 rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">{busy ? "保存中…" : alreadyDone ? "✓ 内容を上書き保存" : "✓ 今日のトレ完了"}</button>
            </div>
          )}
        </div>
      </div>

      {/* 種目追加シート */}
      <BottomSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="種目を追加">
        <AddExerciseSheet
          existing={(mode === "edit" ? items : fromLogged(editedItems ?? toLogged(buildInitial()))).map((it) => it.exerciseName)}
          onAdd={addItem}
        />
      </BottomSheet>

      {/* 動画ライトボックス */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
            <VimeoEmbed url={lightbox.url} />
            <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
              <span className="text-[13px] font-bold">{lightbox.name}</span>
              <button type="button" onClick={() => setLightbox(null)} className="text-lg text-zinc-400" aria-label="閉じる">✕</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// M8 .val 表記
function numText(it?: LoggedItem | null): string | null {
  if (!it || (it.weightKg == null && it.reps == null && it.sets == null)) return null;
  const head = [it.weightKg != null ? `${it.weightKg}kg` : null, it.reps != null ? `${it.reps}回` : null].filter(Boolean).join(" ・ ");
  const tail = it.sets != null ? `${head ? " " : ""}× ${it.sets}` : "";
  return head + tail || null;
}

function ViewList({
  original,
  overrideItems,
  intensityLabel,
  theme,
  onPlay,
  videoOf,
}: {
  original: Exercise[];
  overrideItems: LoggedItem[] | null;
  intensityLabel: string;
  theme: string;
  onPlay: (url: string, name: string) => void;
  videoOf: (name: string, orig?: Exercise) => string | null;
}) {
  const origText = (e: { 回数: string }) => {
    const rs = parseRepsSets(e.回数);
    return rs.reps != null ? `${rs.reps}回${rs.sets != null ? ` × ${rs.sets}` : ""}` : cleanReps(e.回数);
  };
  const origMap = new Map(original.map((e) => [e.種目名, e]));
  type Row = { name: string; source: "original" | "added"; url: string | null; val: string };
  const rows: Row[] = overrideItems
    ? overrideItems.map((it) => ({
        name: it.exerciseName,
        source: it.source,
        url: videoOf(it.exerciseName, origMap.get(it.exerciseName)),
        val: numText(it) ?? (origMap.has(it.exerciseName) ? origText(origMap.get(it.exerciseName)!) : "記録あり"),
      }))
    : original.map((e) => ({ name: e.種目名, source: "original", url: videoOf(e.種目名, e), val: origText(e) }));

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#e7dcc9] p-6 text-center text-[12px] text-[#a59b8c]">この日の種目は設定されていません。</p>;
  }
  return (
    <div className="overflow-hidden rounded-[13px] border border-[#e7dcc9] bg-white">
      <div className="border-b border-[#f3eddf] px-3 py-2 text-[10px] font-extrabold text-[#6a6256]">今日の内容（{intensityLabel}強度・{theme}）</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[#f3eddf] px-3 py-2.5 last:border-b-0">
          {r.url ? (
            <PlayBtn onClick={() => onPlay(r.url!, cleanExerciseName(r.name))} />
          ) : r.source === "added" ? (
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center">
              <span className="rounded bg-[#4a875b] px-1.5 py-0.5 text-[9px] font-bold text-white">追加</span>
            </span>
          ) : (
            <span className="h-[34px] w-[34px] flex-shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">{cleanExerciseName(r.name)}</div>
          <span className="whitespace-nowrap text-[11px] font-bold text-[#6a6256]">{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function EditList({
  items,
  original,
  origByName,
  invalidIdx,
  expanded,
  onExpand,
  onPatch,
  onOpenAdd,
  onPlay,
  videoOf,
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
  videoOf: (name: string, orig?: Exercise) => string | null;
}) {
  const origMap = new Map(original.map((e) => [e.種目名, e]));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const url = videoOf(it.exerciseName, origMap.get(it.exerciseName));
        const orig = origByName.get(it.exerciseName) ?? null;
        const invalid = invalidIdx.includes(i);
        return (
          <div key={i} className={`rounded-xl border-[1.5px] px-3 py-2.5 ${invalid ? "border-[#e0857a] bg-[#fdeee9]" : it.removed ? "border-[#e7dcc9] bg-[#f5f1e8] opacity-70" : it.source === "added" ? "border-[#d7e6db] bg-[#eef5f0]" : "border-[#e7dcc9] bg-white"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`flex-1 text-[13px] font-bold ${it.removed ? "text-[#a59b8c] line-through" : "text-[#2b2620]"}`}>
                {cleanExerciseName(it.exerciseName)}
                {it.source === "added" && <span className="ml-1.5 rounded bg-[#4a875b] px-1 py-0.5 text-[8px] text-white">追加</span>}
              </span>
              {url && !it.removed && <PlayBtn onClick={() => onPlay(url, cleanExerciseName(it.exerciseName))} />}
              <button type="button" onClick={() => onPatch(i, { removed: !it.removed })} className="flex h-9 items-center rounded-full border border-[#d8cdba] px-3 text-[11px] font-bold text-[#a59b8c]">
                {it.removed ? "戻す" : "はずす"}
              </button>
            </div>
            {!it.removed && (
              <div className="mt-2 flex gap-2">
                {([
                  { field: "kg" as const, label: "kg", val: it.weightKg, o: null as number | null },
                  { field: "reps" as const, label: "回", val: it.reps, o: orig?.reps ?? null },
                  { field: "sets" as const, label: "セット", val: it.sets, o: orig?.sets ?? null },
                ]).map((c) => {
                  const isOpen = expanded?.i === i && expanded.field === c.field;
                  return (
                    <div key={c.field} className="flex-1">
                      <button type="button" onClick={() => onExpand(isOpen ? null : { i, field: c.field })} className={`w-full rounded-[9px] border-[1.5px] px-1 py-1.5 text-center ${isOpen ? "border-[#34603f] bg-[#f0f7f2]" : "border-[#d9dce0] bg-[#edeef0]"}`}>
                        <div className="text-[8px] font-bold text-[#a59b8c]">{c.label}</div>
                        <div className="text-[14px] font-extrabold text-[#2b2620]">{c.val ?? "—"}</div>
                      </button>
                      {isOpen && (
                        <BigStepper
                          field={c.field}
                          value={c.val}
                          step={c.field === "kg" ? 2.5 : 1}
                          onChange={(v) => onPatch(i, { weightKg: c.field === "kg" ? v : it.weightKg, reps: c.field === "reps" ? v : it.reps, sets: c.field === "sets" ? v : it.sets })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={onOpenAdd} className="btn3d mt-1 w-full rounded-xl py-3 text-[13px] font-bold">＋ 種目を追加</button>
    </div>
  );
}

function BigStepper({ field, value, step, onChange }: { field: ExpandField; value: number | null; step: number; onChange: (v: number | null) => void }) {
  const dec = () => {
    const n = Math.round(((value ?? 0) - step) * 10) / 10;
    onChange(n <= 0 ? null : n);
  };
  const inc = () => onChange(Math.round(((value ?? 0) + step) * 10) / 10);
  const unit = field === "kg" ? "kg" : field === "reps" ? "回" : "セット";
  return (
    <div className="mt-2 rounded-[11px] border-[1.5px] border-[#4a875b] bg-[#edeef0] p-2">
      <div className="flex items-center justify-center gap-2">
        <button type="button" aria-label="減らす" onClick={dec} className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#cfe0d4] bg-[#eef5f0] text-[18px] font-bold text-[#34603f]">−</button>
        <input type="number" inputMode="decimal" value={value ?? ""} placeholder="—" onChange={(e) => { const v = e.target.value; if (v === "") return onChange(null); const n = Number(v); onChange(Number.isFinite(n) && n > 0 ? n : null); }} className="h-10 w-16 rounded-[9px] border border-[#cfe0d4] bg-white text-center text-[17px] font-extrabold text-[#2b2620] focus:outline-none" />
        <span className="text-[9px] font-bold text-[#a59b8c]">{unit}</span>
        <button type="button" aria-label="増やす" onClick={inc} className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#cfe0d4] bg-[#eef5f0] text-[18px] font-bold text-[#34603f]">＋</button>
      </div>
    </div>
  );
}

function AddExerciseSheet({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const existingSet = new Set(existing);
  const candidates =
    query.length === 0
      ? []
      : listExercisesWithVideo().filter((e) => e.確定代表名.includes(query) && !existingSet.has(e.確定代表名)).slice(0, 12);
  const exactHit = candidates.some((c) => c.確定代表名 === query);
  return (
    <div className="flex max-h-[58vh] flex-col">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="種目名で検索（例: サ → サイドレイズ）" className="h-11 w-full shrink-0 rounded-lg border border-[#e7dcc9] bg-white px-3 text-[14px] focus:border-[#4a875b] focus:outline-none" />
      {query.length === 0 ? (
        <p className="px-1 py-4 text-center text-[12px] text-[#a59b8c]">種目名を入力すると、動画のある種目が候補に出ます。</p>
      ) : (
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {candidates.map((c) => (
            <button key={c.確定代表名} type="button" onClick={() => onAdd(c.確定代表名)} className="flex w-full items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5 text-left">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f3ec]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#34603f"><polygon points="6 4 20 12 6 20" /></svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">{cleanExerciseName(c.確定代表名)}</span>
              <span className="flex-shrink-0 text-[10px] font-bold text-[#4a875b]">動画あり</span>
            </button>
          ))}
          {!exactHit && (
            <button type="button" onClick={() => onAdd(query)} className="flex w-full items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#4a875b] bg-[#f0f7f2] py-2.5 text-[12.5px] font-bold text-[#34603f]">
              ＋「{query}」を追加する
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// P2: 黒・立体・小(34)
function PlayBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="フォーム動画を見る"
      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: "linear-gradient(#4a4a4a,#181818)", boxShadow: "0 4px 7px rgba(0,0,0,.35), inset 0 1.5px 0 rgba(255,255,255,.28), inset 0 -2px 5px rgba(0,0,0,.5)" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 1 }}><polygon points="7 4 20 12 7 20" /></svg>
    </button>
  );
}
