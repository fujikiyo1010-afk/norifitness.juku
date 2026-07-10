"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkoutCycles } from "@/lib/workout/types";
import {
  resolveDayMenu,
  INTENSITY_LABEL,
  type Intensity,
} from "@/lib/workout/logs-types";
import { cleanExerciseName, cleanReps } from "@/lib/workout/menu-display";
import { completeWorkoutDay } from "@/lib/workout/logs-actions";

/**
 * 実施記録 A画面(M8・P5-1・ベータ)。
 *  - デイヒーロー + 強度セグメント + 種目リスト + ✓今日のトレ完了 + ひとことメモ。
 *  - 編集モード/種目追加/スキップ は P5-2。ここは「開いて1タップで完了」。
 */
export function WorkoutTodayClient({
  cycles,
  dayNumber,
  cycleNumber,
  initialIntensity,
  alreadyDone,
  initialMemo,
  completedAtLabel,
}: {
  cycles: WorkoutCycles;
  dayNumber: number;
  cycleNumber: number;
  initialIntensity: Intensity;
  alreadyDone: boolean;
  initialMemo: string | null;
  completedAtLabel: string | null;
}) {
  const router = useRouter();
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayMenu = useMemo(
    () => resolveDayMenu(cycles, intensity, dayNumber),
    [cycles, intensity, dayNumber]
  );
  const isRest = dayMenu?.種別 === "休息";
  const isPersonal = dayMenu?.種別 === "パーソナル";
  const exercises = (dayMenu?.種目 ?? []).filter((e) => e.種目名);
  const dayLabel = dayMenu?.日 ?? `${dayNumber}日目`;

  async function handleComplete(status: "done" | "rest_done") {
    setError(null);
    setBusy(true);
    try {
      const items =
        status === "done"
          ? exercises.map((e) => ({
              exerciseName: e.種目名,
              source: "original" as const,
            }))
          : [];
      const r = await completeWorkoutDay({
        dayNumber,
        cycleNumber,
        intensity,
        status,
        memo,
        items,
      });
      if (!r.ok) throw new Error(r.message);
      router.replace("/workout/today?done=1");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? `${e.message}（もう一度お試しください）` : "保存に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      {/* デイヒーロー */}
      <div className="rounded-2xl bg-gradient-to-br from-[#4a875b] to-[#34603f] px-4 py-4 text-white">
        <div className="text-[11px] font-bold opacity-90">
          {cycleNumber}周目 ／ {dayNumber}日目
        </div>
        <div className="mt-0.5 text-[18px] font-extrabold">
          {isRest ? "休養日" : isPersonal ? "パーソナル指導日" : dayLabel}
        </div>
      </div>

      {alreadyDone && (
        <div className="rounded-xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-2.5 text-[12px] font-bold text-[#34603f]">
          ✓ 今日のトレは完了済み{completedAtLabel ? `・${completedAtLabel}` : ""}
        </div>
      )}

      {/* 休養日/パーソナル */}
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
          {/* 強度セグメント */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">強度</div>
            <div className="flex gap-1.5 rounded-xl bg-[#f0ece2] p-1">
              {(["small", "medium", "large"] as Intensity[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setIntensity(iv)}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                    intensity === iv ? "bg-[#4a875b] text-white" : "text-[#6a6256]"
                  }`}
                >
                  {INTENSITY_LABEL[iv]}
                </button>
              ))}
            </div>
          </div>

          {/* 種目リスト */}
          <div className="space-y-2">
            {exercises.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#e7dcc9] p-6 text-center text-[12px] text-[#a59b8c]">
                この日の種目は設定されていません。
              </p>
            ) : (
              exercises.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3"
                >
                  <span className="font-mono text-[11px] text-[#a59b8c]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[#2b2620]">
                      {cleanExerciseName(e.種目名)}
                    </div>
                    <div className="text-[11px] text-[#6a6256]">
                      {cleanReps(e.回数)}
                      {e.インターバル ? ` ・ 休憩${e.インターバル}` : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-[#a59b8c]">
            数値の細かい記録（重さ・回数の調整、種目の追加）は次のアップデートで足します。今は「やった／やってない」を残せます。
          </p>
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

      {/* 完了ボタン(下部固定) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[460px]">
          <button
            type="button"
            onClick={() => handleComplete(isRest ? "rest_done" : "done")}
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
          <Link
            href="/workout"
            className="mt-1 block text-center text-[11px] text-[#6a6256]"
          >
            メニュー全体を見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
