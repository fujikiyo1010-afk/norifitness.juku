"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkoutCycles } from "@/lib/workout/types";
import {
  resolveDayMenu,
  parseRepsSets,
  INTENSITY_LABEL,
  type Intensity,
  type LoggedItem,
} from "@/lib/workout/logs-types";
import { cleanExerciseName, cleanReps } from "@/lib/workout/menu-display";
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

  const dayMenu = useMemo(
    () => resolveDayMenu(cycles, intensity, dayNumber),
    [cycles, intensity, dayNumber]
  );
  const isRest = dayMenu?.種別 === "休息";
  const isPersonal = dayMenu?.種別 === "パーソナル";
  const original = (dayMenu?.種目 ?? []).filter((e) => e.種目名);
  const dayLabel = dayMenu?.日 ?? `${dayNumber}日目`;

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

  async function save(status: "done" | "rest_done" | "skipped", useEdited: boolean) {
    setError(null);
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
      setError(
        e instanceof Error ? `${e.message}（もう一度お試しください）` : "保存に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  // 細2: 今日スキップ済み → 記録できないロック表示(次は明日から)
  if (completedToday && todayStatus === "skipped") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#4a875b] to-[#34603f] px-4 py-4 text-white">
          <div className="text-[11px] font-bold opacity-90">
            {cycleNumber}周目 ／ {dayNumber}日目
          </div>
          <div className="mt-0.5 text-[18px] font-extrabold">今日はお休み</div>
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
      {/* デイヒーロー */}
      <div className="rounded-2xl bg-gradient-to-br from-[#4a875b] to-[#34603f] px-4 py-4 text-white">
        <div className="text-[11px] font-bold opacity-90">
          {cycleNumber}周目 ／ {dayNumber}日目
        </div>
        <div className="mt-0.5 text-[18px] font-extrabold">
          {isRest ? "休養日" : isPersonal ? "パーソナル指導日" : dayLabel}
        </div>
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
            <div className="flex gap-1.5 rounded-xl bg-[#f0ece2] p-1">
              {(["small", "medium", "large"] as Intensity[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  disabled={mode === "edit"}
                  onClick={() => setIntensity(iv)}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                    intensity === iv ? "bg-[#4a875b] text-white" : "text-[#6a6256]"
                  } ${mode === "edit" ? "opacity-50" : ""}`}
                >
                  {INTENSITY_LABEL[iv]}
                </button>
              ))}
            </div>
          </div>

          {mode === "view" ? (
            <ViewList original={original} loggedItems={initialItems} />
          ) : (
            <EditList
              items={items}
              onPatch={patch}
              addName={addName}
              setAddName={setAddName}
              onAdd={addItem}
            />
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

      {error && <p className="text-[12px] font-bold text-red-700">❌ {error}</p>}

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
          ) : (
            <>
              <button
                type="button"
                onClick={() => save(isRest ? "rest_done" : "done", false)}
                disabled={busy}
                className="w-full rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy
                  ? "保存中…"
                  : isRest
                    ? "✓ 今日は休んだ（完了）"
                    : alreadyDone
                      ? "✓ 内容を上書き保存"
                      : "✓ 今日のトレ完了"}
              </button>
              {!isRest && !isPersonal && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={enterEdit}
                    className="text-[11px] font-bold text-[#4a875b]"
                  >
                    ✎ 内容を編集
                  </button>
                  {!alreadyDone && (
                    <button
                      type="button"
                      onClick={() => setConfirmSkip(true)}
                      className="text-[11px] text-[#a59b8c]"
                    >
                      今日はやらない →
                    </button>
                  )}
                </div>
              )}
              <Link
                href="/workout"
                className="block text-center text-[11px] text-[#6a6256]"
              >
                メニュー全体を見る →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 表示リスト(readonly)
function ViewList({
  original,
  loggedItems,
}: {
  original: import("@/lib/workout/types").Exercise[];
  loggedItems: LoggedItem[];
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
  const numText = (it?: LoggedItem) =>
    it && (it.weightKg != null || it.reps != null || it.sets != null)
      ? [
          it.weightKg != null ? `${it.weightKg}kg` : null,
          it.reps != null ? `${it.reps}回` : null,
          it.sets != null ? `×${it.sets}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  return (
    <div className="space-y-2">
      {original.map((e, i) => {
        const log = logByName.get(e.種目名);
        const nt = numText(log);
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3"
          >
            <span className="font-mono text-[11px] text-[#a59b8c]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[#2b2620]">
                {cleanExerciseName(e.種目名)}
              </div>
              <div className="text-[11px] text-[#6a6256]">{nt ?? cleanReps(e.回数)}</div>
            </div>
          </div>
        );
      })}
      {added.map((it, i) => (
        <div
          key={`a${i}`}
          className="flex items-center gap-3 rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-3.5 py-3"
        >
          <span className="rounded bg-[#4a875b] px-1.5 py-0.5 text-[9px] font-bold text-white">
            追加
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-[#2b2620]">
              {cleanExerciseName(it.exerciseName)}
            </div>
            <div className="text-[11px] text-[#6a6256]">{numText(it) ?? "記録あり"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 編集リスト(ステッパー)
function EditList({
  items,
  onPatch,
  addName,
  setAddName,
  onAdd,
}: {
  items: EditItem[];
  onPatch: (i: number, p: Partial<EditItem>) => void;
  addName: string;
  setAddName: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
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
          <div className="flex items-center justify-between">
            <span
              className={`text-[13px] font-bold ${it.removed ? "text-[#a59b8c] line-through" : "text-[#2b2620]"}`}
            >
              {cleanExerciseName(it.exerciseName)}
              {it.source === "added" && (
                <span className="ml-1.5 rounded bg-[#4a875b] px-1 py-0.5 text-[8px] text-white">
                  追加
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onPatch(i, { removed: !it.removed })}
              className="text-[11px] text-[#a59b8c]"
            >
              {it.removed ? "戻す" : "✕"}
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
      ))}

      {/* 種目追加 */}
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
          className="flex-1 rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-[#f0ece2] px-4 text-[12px] font-bold text-[#5b5344]"
        >
          追加
        </button>
      </div>
    </div>
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
  return (
    <div className="flex flex-1 items-center rounded-lg border border-[#e7dcc9] bg-white">
      <button type="button" onClick={dec} className="px-2 py-1.5 text-[15px] text-[#6a6256]">
        −
      </button>
      <div className="flex-1 text-center text-[12px] font-bold text-[#2b2620]">
        {value ?? "—"}
        <span className="ml-0.5 text-[9px] font-medium text-[#a59b8c]">{label}</span>
      </div>
      <button type="button" onClick={inc} className="px-2 py-1.5 text-[15px] text-[#6a6256]">
        ＋
      </button>
    </div>
  );
}
