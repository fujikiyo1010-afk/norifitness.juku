"use client";

import { useState, type ReactNode } from "react";
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
import { resolveExerciseVideo } from "@/lib/workout/video-master";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { MoonIcon, UsersIcon } from "@/components/icons";

/**
 * 配布済メニューの本体表示 (Client Component)
 *
 * 2026-07-13 再設計(確定モック 08_guide/提案_受講生_筋トレ原本_確定版.html を転写):
 *   戻りヘッダ廃止・全幅・ヒーロー大型化・強度/日タブ/スーパーセット再スタイル・
 *   下部固定「メニュー変更リクエスト」1本(緑立体・下部ナビの直上)。
 *   ★表示ロジック(強度/日/種目/スーパーセット対/休息・パーソナル/カルテ項目/メモ/動画)は現行のまま。
 *   ※カルテ更新リクエストの動線はプロフィール→カルテ で存置(このバーからは外す)。
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
  // 動画ライトボックス (種目タップで開く)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

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
    <div className="min-h-screen bg-[#f9f5ed] pb-[84px]">
      <div className="mx-auto w-full max-w-[480px]">
        {/* ヒーロー(戻りヘッダ廃止・全幅・大型) */}
        <div className="bg-gradient-to-br from-[#e8f3ec] to-[#fffbe6] px-4 pb-4 pt-6 text-center">
          <h1 className="text-[21px] font-extrabold text-[#2b2620]">
            あなたの今月のメニュー
          </h1>
          <div className="mt-1.5 text-[12px] font-bold text-[#6a6256]">
            {envDisplay}
            <span className="mx-2 text-[#a59b8c]">｜</span>
            {freqDisplay}
            {focusDisplay && (
              <>
                <span className="mx-2 text-[#a59b8c]">｜</span>
                {focusDisplay}
              </>
            )}
          </div>
          <div className="mt-1 text-[10px] text-[#a59b8c]">
            配布 {formatDistributionDate(menu.effective_from)} / 全 {cycles.length} 強度
          </div>
        </div>

        {/* カルテ(折りたたみ・現行の項目/挙動のまま) */}
        <details className="border-b border-[#eee5d4] bg-[#fffdf8] px-4 py-2.5">
          <summary className="cursor-pointer select-none list-none text-[12px] font-bold text-[#6a6256]">
            提出したカルテ ▾
          </summary>
          <dl className="mt-3 grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-[11px] text-[#6a6256]">性別</dt>
            <dd className="font-semibold text-[#2b2620]">{carte.gender}</dd>
            <dt className="text-[11px] text-[#6a6256]">使える環境</dt>
            <dd className="font-semibold text-[#2b2620]">{envDisplay}</dd>
            <dt className="text-[11px] text-[#6a6256]">理想の頻度</dt>
            <dd className="font-semibold text-[#2b2620]">{freqDisplay}</dd>
            <dt className="text-[11px] text-[#6a6256]">鍛えたい部位</dt>
            <dd className="font-semibold text-[#2b2620]">
              {carte.focus_body_parts.join("・") || "—"}
            </dd>
          </dl>
        </details>

        {/* のり氏メモ */}
        {noteLines.length > 0 && (
          <div className="mx-3.5 my-3 rounded-xl border-[1.5px] border-[#f0e0a0] bg-[#fffbe6] px-3.5 py-3">
            <div className="mb-1 text-[10px] font-extrabold text-[#a5631f]">
              のりfitness メモ
            </div>
            <div className="space-y-0.5 text-[12.5px] leading-relaxed text-[#2b2620]">
              {noteLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}

        <div className="px-3.5">
          {/* 強度選択 (2 つ以上のときだけ) */}
          {cycles.length > 1 && (
            <>
              <div className="mb-1.5 mt-2.5 text-[11px] font-extrabold text-[#6a6256]">
                強度
              </div>
              <div className="flex gap-2">
                {cycles.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCycleChange(i)}
                    className={`flex-1 rounded-[10px] py-2.5 text-[12px] font-extrabold transition-colors ${
                      i === activeCycleIdx
                        ? "border-2 border-[#34603f] bg-[#e8f3ec] text-[#34603f]"
                        : "border-[1.5px] border-[#e0d6c2] bg-[#fffdf8] text-[#6a6256]"
                    }`}
                  >
                    <span className="mr-1 font-mono text-[10px] text-[#a59b8c]">
                      {i + 1}:
                    </span>
                    {c["段階"] || `強度${i + 1}`}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 日タブ (2 日以上のとき) */}
          {dayCount > 1 && (
            <div className="mt-3 flex gap-0.5 overflow-x-auto border-b-2 border-[#eee5d4]">
              {activeCycle["週"].map((w, i) => {
                const kind = w["種別"];
                const sub = kind ? kind : `${w["種目"]?.length ?? 0}種目`;
                const on = i === activeDayIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveDayIdx(i)}
                    className={`min-w-[54px] flex-1 whitespace-nowrap px-1 py-1.5 text-[12px] font-extrabold transition-colors ${
                      on
                        ? "-mb-0.5 border-b-2 border-[#34603f] text-[#34603f]"
                        : "text-[#a59b8c]"
                    }`}
                  >
                    {cleanDayLabel(w["日"])}
                    <span
                      className={`mt-0.5 block text-[9px] font-bold ${
                        kind ? "text-[#c08a2d]" : "text-[#a59b8c]"
                      }`}
                    >
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 種目リスト (休息/パーソナルは専用カード ・ スーパーセットはペア表示) */}
          <div className="pb-4">
            {activeDay?.["種別"] === "休息" ? (
              <RestCard kind="休息" />
            ) : activeDay?.["種別"] === "パーソナル" ? (
              <RestCard kind="パーソナル" />
            ) : exercises.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6a6256]">
                この日の種目はありません
              </div>
            ) : (
              <ExerciseList
                exercises={exercises}
                onPlay={(url, name) => setLightbox({ url, name })}
              />
            )}
          </div>
        </div>
      </div>

      {/* 固定リクエストバー(下部ナビの直上・sticky)。カルテ更新はプロフィール→カルテ で存置。 */}
      <div
        className="fixed inset-x-0 z-30 border-t border-[#e7dcc9] bg-[rgba(249,245,237,0.95)] px-4 py-2.5 backdrop-blur-sm"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-[480px]">
          <Link
            href="/workout/menu/request"
            className="block rounded-[10px] py-3 text-center text-[13.5px] font-extrabold text-white active:translate-y-[2px]"
            style={{
              background: "linear-gradient(180deg,#54946a,#4a875b 45%,#34603f)",
              boxShadow: "0 5px 0 #274c31, 0 9px 18px rgba(52,96,63,0.3)",
            }}
          >
            メニュー変更リクエスト
          </Link>
        </div>
      </div>

      {/* 動画ライトボックス (種目タップで開く) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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

// =====================================================================
// 種目 1 行
// =====================================================================

// 休息日 / パーソナル日 のカード(絵文字→線画SVG)
function RestCard({ kind }: { kind: "休息" | "パーソナル" }) {
  const isPersonal = kind === "パーソナル";
  return (
    <div className="px-5 py-9 text-center">
      <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center text-[#4a875b]">
        {isPersonal ? <UsersIcon size={30} /> : <MoonIcon size={28} />}
      </div>
      <div className="mt-2 text-[15px] font-bold text-[#2b2620]">
        {isPersonal ? "パーソナル日" : "休息日"}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-[#6a6256]">
        {isPersonal
          ? "外部のパーソナル指導を受ける日です。こちらのメニューはお休みです。"
          : "今日はしっかり休んで回復に充てましょう。無理せず OK です。"}
      </div>
    </div>
  );
}

// 種目リスト (スーパーセットは 1種目目+次種目 をペアで括る)
function ExerciseList({
  exercises,
  onPlay,
}: {
  exercises: Exercise[];
  onPlay: (url: string, name: string) => void;
}) {
  const blocks: ReactNode[] = [];
  let i = 0;
  let num = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    if (ex["superset"] && i + 1 < exercises.length) {
      const a = ex;
      const b = exercises[i + 1];
      blocks.push(
        <div
          key={i}
          className="my-2.5 rounded-r-xl border-l-[3px] border-[#4a875b] bg-[#fbfdfc]"
        >
          <div className="px-3 pb-0.5 pt-2.5 text-[11px] font-extrabold text-[#34603f]">
            スーパーセット（休まず続けて）
          </div>
          <ExerciseRow num={num + 1} ex={a} onPlay={onPlay} />
          <ExerciseRow num={num + 2} ex={b} onPlay={onPlay} />
        </div>
      );
      num += 2;
      i += 2;
    } else {
      blocks.push(<ExerciseRow key={i} num={num + 1} ex={ex} onPlay={onPlay} />);
      num += 1;
      i += 1;
    }
  }
  return <div className="mt-2">{blocks}</div>;
}

function ExerciseRow({
  num,
  ex,
  onPlay,
}: {
  num: number;
  ex: Exercise;
  onPlay: (url: string, name: string) => void;
}) {
  const name = cleanExerciseName(ex["種目名"]);
  const reps = cleanReps(ex["回数"]);
  const interval = ex["インターバル"] || "—";
  const target = getExerciseTarget(ex["主部位"]);
  const videoUrl = resolveExerciseVideo(ex);

  return (
    <div
      className={`flex items-center gap-2.5 border-b border-[#f3eddf] px-3 py-3 last:border-0 ${
        videoUrl ? "cursor-pointer active:bg-[rgba(0,137,123,0.05)]" : ""
      }`}
      onClick={videoUrl ? () => onPlay(videoUrl, name) : undefined}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#f0ece2] font-mono text-sm font-extrabold text-zinc-700">
        {num}
      </div>
      <div className="min-w-0 flex-1">
        <b className="block text-[14.5px] font-bold leading-tight text-[#2b2620]">
          {name}
        </b>
        <span className="mt-1 block text-[11px] font-bold leading-relaxed text-[#6a6256]">
          {reps}
          <span className="mx-1 text-zinc-300">｜</span>
          休憩 {interval}
          <span className="mx-1 text-zinc-300">｜</span>
          <span className="font-normal text-[#6a6256]">狙い: </span>
          <span className="font-bold text-[#34603f]">{target}</span>
        </span>
      </div>
      {videoUrl ? (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#4a875b] text-white"
          aria-label="動画あり"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
            <polygon points="6 4 20 12 6 20" />
          </svg>
        </div>
      ) : (
        <div className="flex-shrink-0 text-center text-[9px] leading-tight text-[#a59b8c]">
          動画
          <br />
          なし
        </div>
      )}
    </div>
  );
}
