import { redirect } from "next/navigation";
import Link from "next/link";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getTodayWorkout, getMyProgress } from "@/lib/workout/logs";
import { getTodayActivity } from "@/lib/member/today-activity";
import { getRecordStreak } from "@/lib/member/record-streak";
import { createClient } from "@/lib/supabase/server";
import { jstTodayStr } from "@/lib/date/jst";
import { resolveDayMenu } from "@/lib/workout/logs-types";
import { cleanExerciseName, getExerciseTarget } from "@/lib/workout/menu-display";
import type { WorkoutCycles } from "@/lib/workout/types";
import { WorkoutTodayClient } from "./WorkoutTodayClient";
import { StartWorkoutButton } from "./StartWorkoutButton";
import { StripDoneQuery } from "./StripDoneQuery";

/**
 * 新3b: 完了演出の「明日は 1周◯日目・◯◯の日」ラベル。
 * 前進後の progress を使い、「◯日目」の二重表記(細12と同規則)を避ける。
 */
function nextDayLabel(
  cycles: WorkoutCycles,
  cycleNumber: number,
  dayNumber: number
): string {
  const dm = resolveDayMenu(cycles, "medium", dayNumber);
  let tail = "";
  if (dm?.種別 === "休息") tail = "・休養日";
  else if (dm?.種別 === "パーソナル") tail = "・パーソナル指導日";
  else if (dm?.日 && dm.日 !== `${dayNumber}日目`) tail = `・${dm.日}`;
  else {
    const t = getExerciseTarget((dm?.種目 ?? []).flatMap((e) => e.主部位 ?? []));
    if (t && t !== "全身") tail = `・${t}の日`;
  }
  return `明日は ${cycleNumber}周${dayNumber}日目${tail}`;
}

export const dynamic = "force-dynamic";

/**
 * 実施記録(記録専用ページ・P5・ベータ限定)。
 * 未配布/未開始/実施記録 の3状態。下ナビ「筋トレ」(/workout)は原本閲覧のまま。
 */
export default async function WorkoutTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/workout");

  const sp = await searchParams;
  const w = await getTodayWorkout();
  // 点7: その日「のりのコメント(daily_feedbacks sent)」が届いていれば編集ロック(食事と同じ導出・RLSで本人のみ)
  let feedbackLocked = false;
  if (w.started) {
    const supabase = await createClient();
    const { data: fb } = await supabase
      .from("daily_feedbacks")
      .select("id")
      .eq("date", jstTodayStr())
      .eq("status", "sent")
      .limit(1);
    feedbackLocked = (fb?.length ?? 0) > 0;
  }
  // 新3a: バナーは「?done=1 かつ 今日を実際に完了(done/rest_done)」の時だけ。
  const showCeleb =
    sp.done === "1" &&
    w.completedToday &&
    (w.todayLog?.status === "done" || w.todayLog?.status === "rest_done");
  // 細16: 完了演出の「今日の達成 n/3」バー(トレ+食事+学び)
  const act = showCeleb ? await getTodayActivity() : null;
  const doneCount = act
    ? (act.learned ? 1 : 0) + (act.recordedMeal ? 1 : 0) + (act.recordedWorkout ? 1 : 0)
    : 0;
  // 新3b: 「明日は…」は前進後の progress を使う(完了当日が「次は」に出る誤りを解消)
  const prog = showCeleb ? await getMyProgress() : null;
  const nextLabel =
    prog && w.cycles
      ? nextDayLabel(w.cycles, prog.cycleNumber, prog.currentDay)
      : null;
  // ④: 完了演出に「継続◯日」(記録が続いた連続日数・0は出さない)
  const streakDays = showCeleb ? await getRecordStreak() : 0;

  return (
    <>
      <MemberHeader title="今日のトレーニング" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {showCeleb && (
            /* PR-T2: M10の祝福トーンに転写(濃緑ベタ→淡色グラデ+緑チェック円+濃緑文字) */
            <div className="mb-3 rounded-2xl border border-[#cfe3d6] bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-4 py-6 text-center">
              <StripDoneQuery />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#4a875b] text-[26px] font-extrabold text-white">
                ✓
              </div>
              <div className="mt-2.5 text-[16px] font-extrabold text-[#34603f]">
                記録しました！
              </div>
              <div className="mt-0.5 text-[12px] text-[#6a6256]">
                おつかれさまでした。
              </div>
              {/* ④: 継続◯日(M10 .fire転写・炎SVG+淡橙ピル) */}
              {streakDays > 0 && (
                <div className="mx-auto mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#fcd9ad] bg-[#fff4e6] px-3 py-1 text-[12px] font-extrabold text-[#c2600f]">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c2600f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                  継続 {streakDays} 日
                </div>
              )}
              {/* 細16: 今日の達成 n/3 バー */}
              <div className="mx-auto mt-3 flex max-w-[280px] items-center gap-2">
                <span className="font-mono text-[13px] font-extrabold text-[#34603f]">
                  {doneCount}/3
                </span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#cfe3d6]">
                  <div
                    className="h-full rounded-full bg-[#4a875b]"
                    style={{ width: `${(doneCount / 3) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-[#6a6256]">今日の達成</span>
              </div>
              {nextLabel && (
                <div className="mt-3 rounded-xl border border-[#cfe3d6] bg-white/60 px-3 py-2 text-[12px] font-bold text-[#34603f]">
                  {nextLabel}
                </div>
              )}
              <div className="mt-3 flex justify-center gap-2">
                <Link
                  href="/"
                  className="rounded-full border border-[#cfe3d6] bg-white/70 px-4 py-1.5 text-[12px] font-bold text-[#34603f]"
                >
                  ホームに戻る →
                </Link>
                <Link
                  href="/workout/history"
                  className="rounded-full border border-[#cfe3d6] bg-white/70 px-4 py-1.5 text-[12px] font-bold text-[#34603f]"
                >
                  履歴を見る
                </Link>
              </div>
            </div>
          )}

          {!w.hasMenu ? (
            <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-8 text-center">
              <p className="text-[13px] leading-relaxed text-[#6a6256]">
                まだトレーニングメニューが届いていません。
                <br />
                のりが準備中です。少しお待ちください。
              </p>
            </div>
          ) : !w.started ? (
            <StartCard cycles={w.cycles} />
          ) : (
            <WorkoutTodayClient
              cycles={w.cycles!}
              dayNumber={w.dayNumber}
              cycleNumber={w.cycleNumber}
              initialIntensity={w.todayLog?.intensity ?? "medium"}
              alreadyDone={w.todayLog?.status === "done" || w.todayLog?.status === "rest_done"}
              initialMemo={w.todayLog?.memo ?? null}
              initialItems={w.todayLog?.items ?? []}
              completedAtLabel={
                w.todayLog?.completedAt
                  ? new Date(
                      new Date(w.todayLog.completedAt).getTime() + 9 * 3600 * 1000
                    )
                      .toISOString()
                      .slice(11, 16)
                  : null
              }
              completedToday={w.completedToday}
              todayStatus={w.todayLog?.status ?? null}
              pending={w.pending}
              feedbackLocked={feedbackLocked}
            />
          )}
        </div>
      </main>
    </>
  );
}

/** 未開始: 1日目のプレビュー + 開始ボタン */
function StartCard({ cycles }: { cycles: import("@/lib/workout/types").WorkoutCycles | null }) {
  const day1 = cycles ? resolveDayMenu(cycles, "medium", 1) : null;
  const exercises = (day1?.種目 ?? []).filter((e) => e.種目名).slice(0, 6);
  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4">
        <div className="text-[12px] font-bold text-[#34603f]">
          メニューが届いています
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6a6256]">
          内容を確認して「開始」を押すと、押した日が1日目になります。1日1タップで記録できます。
        </p>
        {day1 && (
          <div className="mt-3 rounded-xl bg-[#f9f5ed] p-3">
            <div className="text-[11px] font-bold text-[#6a6256]">
              1日目・{day1.日}
            </div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-[#5b5344]">
              {exercises.map((e, i) => (
                <li key={i}>・{cleanExerciseName(e.種目名)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[460px]">
          <StartWorkoutButton />
        </div>
      </div>
    </div>
  );
}
