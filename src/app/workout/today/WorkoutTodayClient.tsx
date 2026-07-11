"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Exercise, WorkoutCycles } from "@/lib/workout/types";
import {
  resolveDayMenu,
  parseRepsSets,
  INTENSITY_LABEL,
  type Intensity,
  type LoggedItem,
} from "@/lib/workout/logs-types";
import { cleanExerciseName, cleanReps, getExerciseTarget } from "@/lib/workout/menu-display";
import { resolveExerciseVideo } from "@/lib/workout/video-master";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { completeWorkoutDay } from "@/lib/workout/logs-actions";

/**
 * 実施記録 A画面 + 編集モード + スキップ(M8/M9・P5-2・ベータ)。
 *  - view: 種目リスト表示 + ✓完了 + ✎編集 + 今日はやらない(スキップ)。
 *  - edit: 種目ごとに重さ/回数/セットのステッパー + ✕/戻す + ＋種目追加 → ✓この内容で完了。
 */

type EditItem = LoggedItem & { removed: boolean; original: boolean };

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

  const dayMenu = useMemo(
    () => resolveDayMenu(cycles, intensity, dayNumber),
    [cycles, intensity, dayNumber]
  );
  const isRest = dayMenu?.種別 === "休息";
  const isPersonal = dayMenu?.種別 === "パーソナル";
  const original = (dayMenu?.種目 ?? []).filter((e) => e.種目名);
  const dayLabel = dayMenu?.日 ?? `${dayNumber}日目`;
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

  // 編集用アイテム(既存ログ優先、なければ原本の初期値)
  const [items, setItems] = useState<EditItem[]>(() => buildInitial());
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

  function enterEdit() {
    setItems(buildInitial());
    setMode("edit");
  }

  function patch(i: number, p: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  const [addName, setAddName] = useState("");
  function addItem() {
    const v = addName.trim();
    if (!v) return;
    setItems((prev) => [
      ...prev,
      { exerciseName: v, source: "added", weightKg: null, reps: null, sets: null, removed: false, original: false },
    ]);
    setAddName("");
  }

  // 点16: 直近の保存操作(もう一度試す用)
  const [lastAttempt, setLastAttempt] = useState<{
    status: "done" | "rest_done" | "skipped";
    useEdited: boolean;
  } | null>(null);

  async function save(status: "done" | "rest_done" | "skipped", useEdited: boolean) {
    setError(null);
    setLastAttempt({ status, useEdited });
    setBusy(true);
    try {
      let payloadItems: LoggedItem[] = [];
      if (status === "done") {
        payloadItems = useEdited
          ? items
              .filter((it) => !it.removed)
              .map(({ exerciseName, source, weightKg, reps, sets }) => ({
                exerciseName,
                source,
                weightKg,
                reps,
                sets,
              }))
          : original.map((e) => ({
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

      {alreadyDone && mode === "view" && (
        <div className="rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-2.5 text-[12px] font-bold text-[#34603f]">
          ✓ 今日のトレは完了済み{completedAtLabel ? `・${completedAtLabel}` : ""}（内容を直せます）
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
          {/* 強度 */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">強度</div>
            {/* M8 .stg転写: トラック無し・枠付きピル・選択=#34603f塗り */}
            <div className="flex gap-1.5">
              {(["small", "medium", "large"] as Intensity[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  disabled={mode === "edit"}
                  onClick={() => setIntensity(iv)}
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

          {mode === "view" ? (
            <ViewList
              original={original}
              loggedItems={initialItems}
              intensityLabel={INTENSITY_LABEL[intensity]}
              onPlay={(url, name) => setLightbox({ url, name })}
            />
          ) : (
            <EditList
              items={items}
              original={original}
              onPatch={patch}
              addName={addName}
              setAddName={setAddName}
              onAdd={addItem}
              onPlay={(url, name) => setLightbox({ url, name })}
            />
          )}

          {/* 細13: 今日はやらない/メニュー全体は本体(通常領域)へ */}
          {mode === "view" && !alreadyDone && (
            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              className="mt-1 block w-full text-center text-[12px] text-[#a59b8c]"
            >
              今日はやらない →
            </button>
          )}
          <Link
            href="/workout"
            className="block text-center text-[11px] text-[#6a6256]"
          >
            メニュー全体を見る →
          </Link>
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
          {lastAttempt && (
            <button
              type="button"
              onClick={() => save(lastAttempt.status, lastAttempt.useEdited)}
              disabled={busy}
              className="flex-shrink-0 rounded-lg bg-[#4a875b] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              もう一度試す
            </button>
          )}
        </div>
      )}

      {/* 下部固定バー */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[460px] space-y-1.5">
          {mode === "edit" ? (
            <>
              <button
                type="button"
                onClick={() => save("done", true)}
                disabled={busy}
                className="w-full rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "保存中…" : "✓ この内容で完了"}
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="w-full text-center text-[11px] text-[#6a6256]"
              >
                編集をやめる
              </button>
            </>
          ) : confirmSkip ? (
            <div className="rounded-xl border border-[#f0e2b8] bg-[#fffbeb] p-3">
              <p className="text-[12px] leading-snug text-[#8a6d1a]">
                {dayNumber}日目をとばして次の日から始めますか？（この日は「未実施」として記録に残ります）
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => save("skipped", false)}
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
          ) : isRest || isPersonal ? (
            <button
              type="button"
              onClick={() => save(isRest ? "rest_done" : "done", false)}
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
                onClick={() => save("done", false)}
                disabled={busy}
                className="flex-1 rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "保存中…" : alreadyDone ? "✓ 内容を上書き保存" : "✓ 今日のトレ完了"}
              </button>
            </div>
          )}
        </div>
      </div>

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

// 表示リスト(readonly)。M8 .list転写: 1枚カード内を .lh見出し + .ex行区切りで。
function ViewList({
  original,
  loggedItems,
  intensityLabel,
  onPlay,
}: {
  original: Exercise[];
  loggedItems: LoggedItem[];
  intensityLabel: string;
  onPlay: (url: string, name: string) => void;
}) {
  const logByName = new Map(loggedItems.map((it) => [it.exerciseName, it]));
  const added = loggedItems.filter((it) => it.source === "added");
  if (original.length === 0 && added.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#e7dcc9] p-6 text-center text-[12px] text-[#a59b8c]">
        この日の種目は設定されていません。
      </p>
    );
  }
  // M8 .val 表記: 「14kg ・ 12回 × 3」
  const numText = (it?: LoggedItem) => {
    if (!it || (it.weightKg == null && it.reps == null && it.sets == null)) return null;
    const head = [
      it.weightKg != null ? `${it.weightKg}kg` : null,
      it.reps != null ? `${it.reps}回` : null,
    ]
      .filter(Boolean)
      .join(" ・ ");
    const tail = it.sets != null ? `${head ? " " : ""}× ${it.sets}` : "";
    return head + tail || null;
  };
  return (
    <div className="overflow-hidden rounded-[13px] border border-[#e7dcc9] bg-[#fffdf8]">
      {/* 点8: リスト見出し(.lh・選択強度に追随) */}
      <div className="border-b border-[#f3eddf] px-3 py-2 text-[10px] font-extrabold text-[#6a6256]">
        今日の内容（{intensityLabel}強度）
      </div>
      {original.map((e, i) => {
        const log = logByName.get(e.種目名);
        const nt = numText(log);
        // 揃え(③): 未ログの原本値もモック書式「◯回 × ◯」に統一
        const rs = parseRepsSets(e.回数);
        const origText =
          rs.reps != null
            ? `${rs.reps}回${rs.sets != null ? ` × ${rs.sets}` : ""}`
            : cleanReps(e.回数);
        const videoUrl = resolveExerciseVideo(e);
        return (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-[#f3eddf] px-3 py-2.5 last:border-b-0"
          >
            {videoUrl ? (
              <PlayBtn onClick={() => onPlay(videoUrl, cleanExerciseName(e.種目名))} />
            ) : (
              <span className="h-11 w-11 flex-shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">
              {cleanExerciseName(e.種目名)}
            </div>
            <span className="whitespace-nowrap text-[11px] font-bold text-[#6a6256]">
              {nt ?? origText}
            </span>
          </div>
        );
      })}
      {added.map((it, i) => (
        <div
          key={`a${i}`}
          className="flex items-center gap-2 border-b border-[#f3eddf] px-3 py-2.5 last:border-b-0"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
            <span className="rounded bg-[#4a875b] px-1.5 py-0.5 text-[9px] font-bold text-white">
              追加
            </span>
          </span>
          <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">
            {cleanExerciseName(it.exerciseName)}
          </div>
          <span className="whitespace-nowrap text-[11px] font-bold text-[#6a6256]">
            {numText(it) ?? "記録あり"}
          </span>
        </div>
      ))}
    </div>
  );
}

// 編集リスト(ステッパー)
function EditList({
  items,
  original,
  onPatch,
  addName,
  setAddName,
  onAdd,
  onPlay,
}: {
  items: EditItem[];
  original: Exercise[];
  onPatch: (i: number, p: Partial<EditItem>) => void;
  addName: string;
  setAddName: (v: string) => void;
  onAdd: () => void;
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
        const videoUrl = videoByName.get(it.exerciseName);
        return (
        <div
          key={i}
          className={`rounded-xl border px-3 py-2.5 ${
            it.removed
              ? "border-[#e7dcc9] bg-[#f5f1e8] opacity-70"
              : it.source === "added"
                ? "border-[#d7e6db] bg-[#eef5f0]"
                : "border-[#e7dcc9] bg-[#fffdf8]"
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
            <div className="mt-2 flex gap-2">
              <Stepper
                label="kg"
                value={it.weightKg}
                step={2.5}
                onChange={(v) => onPatch(i, { weightKg: v })}
              />
              <Stepper
                label="回"
                value={it.reps}
                step={1}
                onChange={(v) => onPatch(i, { reps: v })}
              />
              <Stepper
                label="セット"
                value={it.sets}
                step={1}
                onChange={(v) => onPatch(i, { sets: v })}
              />
            </div>
          )}
        </div>
        );
      })}

      {/* 種目追加(細15: 緑塗りボタン) */}
      <div className="flex gap-2 pt-1">
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="＋ 種目を追加（例: 腹筋ローラー）"
          className="h-11 flex-1 rounded-lg border border-[#e7dcc9] bg-white px-3 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
        <button
          type="button"
          onClick={onAdd}
          className="h-11 rounded-lg bg-[#4a875b] px-5 text-[13px] font-bold text-white"
        >
          ＋ 追加
        </button>
      </div>
    </div>
  );
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

function Stepper({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  onChange: (v: number | null) => void;
}) {
  const dec = () => {
    const base = value ?? 0;
    const next = Math.max(0, Math.round((base - step) * 10) / 10);
    onChange(next === 0 && value == null ? null : next);
  };
  const inc = () => onChange(Math.round(((value ?? 0) + step) * 10) / 10);
  // 細14: 44px + 数値タップで直接入力(未入力は—)
  return (
    <div className="flex-1">
      <div className="mb-0.5 text-center text-[9px] font-medium text-[#a59b8c]">{label}</div>
      <div className="flex items-center rounded-lg border border-[#e7dcc9] bg-white">
        <button type="button" aria-label="減らす" onClick={dec} className="flex h-11 w-9 items-center justify-center text-[18px] text-[#6a6256]">
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-11 w-full min-w-0 border-0 bg-transparent text-center text-[15px] font-bold text-[#2b2620] focus:outline-none"
        />
        <button type="button" aria-label="増やす" onClick={inc} className="flex h-11 w-9 items-center justify-center text-[18px] text-[#6a6256]">
          ＋
        </button>
      </div>
    </div>
  );
}
