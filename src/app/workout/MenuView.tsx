"use client";

import { useState } from "react";
import Link from "next/link";
import {
  cleanExerciseName,
  cleanReps,
  cleanDayLabel,
  getExerciseTarget,
  notesToBullets,
  formatDistributionDate,
  defaultNoriNote,
} from "@/lib/workout/menu-display";
import type {
  UserWorkoutMenuRow,
  CycleStage,
  DayMenu,
  Exercise,
} from "@/lib/workout/types";
import type { CarteWithAgeBand } from "@/lib/workout/queries";

/**
 * 配布済メニューの本体表示 (Client Component)
 *
 * 設計元: /tmp/workout_menu_view_v6.html (確定モック)
 *
 * 状態:
 *   - activeCycleIdx: 現在表示中のサイクル (0-indexed)
 *   - activeDayIdx: 現在表示中の日 (0-indexed)
 */
export function MenuView({
  carte,
  menu,
}: {
  carte: CarteWithAgeBand;
  menu: UserWorkoutMenuRow;
}) {
  const cycles: CycleStage[] = menu.cycles || [];
  const [activeCycleIdx, setActiveCycleIdx] = useState(0);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const activeCycle = cycles[activeCycleIdx];
  const activeDay: DayMenu | undefined = activeCycle?.["週"]?.[activeDayIdx];
  const exercises: Exercise[] = activeDay?.["種目"] || [];

  // 日の数
  const dayCount = activeCycle?.["週"]?.length ?? 0;

  // 重点部位の表示 (例: "大胸筋重点", カルテ.focus_body_parts から)
  const focusDisplay =
    carte.focus_body_parts.length > 0
      ? carte.focus_body_parts.join("・") + "重点"
      : null;

  // 環境表示
  const envDisplay =
    carte.environments.length > 0 ? carte.environments.join("・") : "—";

  // 頻度表示
  const freqDisplay = carte.frequency_wish ?? "—";

  // のり氏メモ: notes があればそれ、なければデフォルト
  const noteText = menu.notes ?? defaultNoriNote(cycles.length);
  const noteLines = notesToBullets(noteText);

  // サイクル切替時、日も先頭に戻す
  function handleCycleChange(idx: number) {
    setActiveCycleIdx(idx);
    setActiveDayIdx(0);
  }

  return (
    <div className="min-h-screen bg-[#ebdfc6]">
      <div className="mx-auto max-w-[460px] px-4 py-6">
        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b border-[#e7dcc9] flex items-center gap-2">
            <Link href="/" className="text-[#2b2620]">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex-1 text-center text-sm font-bold text-[#2b2620]">
              あなたのメニュー
            </div>
            <div className="w-5 h-5" />
          </div>

          {/* ヒーロー (タイトル大、サブ情報を横並び) */}
          <div className="px-4 py-6 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e7dcc9] text-center">
            <h1 className="text-xl font-bold text-[#2b2620] leading-tight mb-2">
              あなたの今月のメニュー
            </h1>
            <div className="text-xs text-zinc-700 leading-relaxed mb-3">
              <span className="font-semibold">{envDisplay}</span>
              <span className="text-[#a59b8c] mx-2">｜</span>
              <span className="font-semibold">{freqDisplay}</span>
              {focusDisplay && (
                <>
                  <span className="text-[#a59b8c] mx-2">｜</span>
                  <span className="font-semibold">{focusDisplay}</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-[#6a6256]">
              配布 {formatDistributionDate(menu.effective_from)} / 全 {cycles.length} 強度
            </div>
          </div>

          {/* カルテサマリ (折りたたみ) */}
          <details className="px-4 py-3 border-b border-[#e7dcc9]">
            <summary className="text-[11px] font-bold text-[#6a6256] cursor-pointer list-none select-none">
              提出したカルテ ▾
            </summary>
            <dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-xs">
              <dt className="text-[#6a6256] text-[11px]">性別</dt>
              <dd className="text-[#2b2620] font-semibold">{carte.gender}</dd>
              <dt className="text-[#6a6256] text-[11px]">使える環境</dt>
              <dd className="text-[#2b2620] font-semibold">{envDisplay}</dd>
              <dt className="text-[#6a6256] text-[11px]">理想の頻度</dt>
              <dd className="text-[#2b2620] font-semibold">{freqDisplay}</dd>
              <dt className="text-[#6a6256] text-[11px]">鍛えたい部位</dt>
              <dd className="text-[#2b2620] font-semibold">
                {carte.focus_body_parts.join("・") || "—"}
              </dd>
            </dl>
          </details>

          {/* のり氏メモ */}
          {noteLines.length > 0 && (
            <div className="m-4 p-3.5 rounded-lg bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)]">
              <div className="text-[10px] font-bold text-[#b8860b] mb-2">
                のりfitness メモ
              </div>
              <ul className="pl-4 text-xs text-[#2b2620] leading-relaxed space-y-1">
                {noteLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 強度選択 (2 つ以上のときだけ) */}
          {cycles.length > 1 && (
            <div className="bg-[#fafafa] border-t border-b border-[#e7dcc9] px-4 pt-2 pb-3">
              <div className="text-[10px] font-bold text-[#6a6256] tracking-widest mb-1.5">
                強度
              </div>
              <div className="flex gap-1.5">
                {cycles.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCycleChange(i)}
                    className={`flex-1 py-2 rounded-md text-[11px] font-bold border transition-colors ${
                      i === activeCycleIdx
                        ? "border-2 border-[#4a875b] bg-[rgba(0,137,123,0.08)] text-[#34603f]"
                        : "border border-[#e7dcc9] bg-[#fffdf8] text-[#6a6256] hover:border-[#4a875b]"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#a59b8c] mr-1">
                      {i + 1}:
                    </span>
                    {c["段階"] || `強度${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 日タブ (2 日以上のとき) */}
          {dayCount > 1 && (
            <div className="flex bg-[#fffdf8] border-b border-[#e7dcc9] overflow-x-auto">
              {activeCycle["週"].map((w, i) => {
                const label = cleanDayLabel(w["日"]);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveDayIdx(i)}
                    className={`flex-1 min-w-[60px] py-3 px-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                      i === activeDayIdx
                        ? "text-[#34603f] border-[#4a875b]"
                        : "text-[#6a6256] border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 種目リスト (ワンライン型 + 狙い末尾) */}
          <div className="bg-[#fffdf8]">
            {exercises.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6a6256]">
                この日の種目はありません
              </div>
            ) : (
              exercises.map((ex, i) => (
                <ExerciseRow key={i} num={i + 1} ex={ex} />
              ))
            )}
          </div>

          {/* フッタ */}
          <div className="bg-[#fffdf8] border-t border-[#e7dcc9] px-4 py-3">
            <Link
              href="/workout/menu/request"
              className="block text-center w-full px-4 py-3 border border-[#4a875b] bg-[#fffdf8] text-[#34603f] rounded-2xl text-xs font-bold hover:bg-[rgba(0,137,123,0.08)] transition-colors"
            >
              メニュー変更リクエスト
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 種目 1 行
// =====================================================================

function ExerciseRow({ num, ex }: { num: number; ex: Exercise }) {
  const name = cleanExerciseName(ex["種目名"]);
  const reps = cleanReps(ex["回数"]);
  const interval = ex["インターバル"] || "—";
  const target = getExerciseTarget(ex["主部位"]);

  return (
    <div className="grid grid-cols-[36px_1fr] gap-3 items-center px-4 py-3.5 border-b border-[#e7dcc9] last:border-b-0">
      <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 font-bold font-mono text-sm flex items-center justify-center">
        {num}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-[#2b2620] leading-tight">
          {name}
        </div>
        <div className="text-[11px] text-[#6a6256] font-mono leading-relaxed mt-1">
          {reps}
          <span className="text-zinc-300 mx-1">｜</span>
          休憩 {interval}
          <span className="text-zinc-300 mx-1">｜</span>
          <span className="text-[#6a6256] font-normal">狙い:</span>
          <span className="text-[#34603f] font-bold">{target}</span>
        </div>
      </div>
    </div>
  );
}
