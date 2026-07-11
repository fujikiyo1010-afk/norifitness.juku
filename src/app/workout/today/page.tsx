import { redirect } from "next/navigation";
import Link from "next/link";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getTodayWorkout, getMyProgress } from "@/lib/workout/logs";
import { getTodayActivity } from "@/lib/member/today-activity";
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

  return (
    <>
      <MemberHeader title="今日のトレーニング" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {showCeleb && (
            <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#4a875b] to-[#34603f] px-4 py-5 text-center text-white">
              <StripDoneQuery />
              <div className="text-[30px] font-extrabold leading-none">✓</div>
              <div className="mt-1.5 text-[16px] font-bold">記録しました！</div>
              <div className="mt-0.5 text-[12px] opacity-90">
                おつかれさまでした。
              </div>
              {/* 細16: 今日の達成 n/3 バー */}
              <div className="mx-auto mt-3 flex max-w-[280px] items-center gap-2">
                <span className="font-mono text-[13px] font-extrabold">{doneCount}/3</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(doneCount / 3) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold opacity-90">今日の達成</span>
              </div>
              {nextLabel && (
                <div className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-[12px] font-bold">
                  {nextLabel}
                </div>
              )}
              <div className="mt-3 flex justify-center gap-2">
                <Link
                  href="/"
                  className="rounded-full bg-white/20 px-4 py-1.5 text-[12px] font-bold"
                >
                  ホームに戻る →
                </Link>
                <Link
                  href="/workout/history"
                  className="rounded-full bg-white/20 px-4 py-1.5 text-[12px] font-bold"
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
