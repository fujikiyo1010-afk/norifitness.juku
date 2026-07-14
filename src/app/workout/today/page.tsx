import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getTodayWorkout } from "@/lib/workout/logs";
import { getTodayActivity } from "@/lib/member/today-activity";
import { getRecordStreak } from "@/lib/member/record-streak";
import { createClient } from "@/lib/supabase/server";
import { jstTodayStr } from "@/lib/date/jst";
import { resolveDayMenu } from "@/lib/workout/logs-types";
import { cleanExerciseName, getExerciseTarget } from "@/lib/workout/menu-display";
import type { WorkoutCycles } from "@/lib/workout/types";
import { WorkoutTodayClient } from "./WorkoutTodayClient";
import { WorkoutTodayClientV2 } from "./WorkoutTodayClientV2";
import { isWorkoutPreviewUser } from "@/lib/workout/preview";
import { StartWorkoutButton } from "./StartWorkoutButton";
import { WorkoutDoneCelebration } from "./WorkoutDoneCelebration";

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

  // 仮反映(2026-07-14): きよむ(藤田)だけ新実施記録V2を表示。他は現行のまま。
  const {
    data: { user: previewUser },
  } = await (await createClient()).auth.getUser();
  const preview = isWorkoutPreviewUser(previewUser?.id);

  // 新3a: バナーは「?done=1 かつ 今日を実際に完了(done/rest_done)」の時だけ。
  const showCeleb =
    sp.done === "1" &&
    w.completedToday &&
    (w.todayLog?.status === "done" || w.todayLog?.status === "rest_done");

  // S2-C: 後続の独立クエリを1回の並列に束ねる(直列を短縮・挙動不変)。
  //   ・点7 feedbackLock: w.started の時だけ daily_feedbacks(sent)を見る(RLSで本人のみ)
  //   ・細16 今日の達成 / ④ 継続日数: 完了演出時だけ
  //   ・新3b「明日は…」の progress は getTodayWorkout 取得済みの w.progress を使い回す(再取得しない)
  const supabase = w.started ? await createClient() : null;
  const [fbRes, act, streakDays] = await Promise.all([
    supabase
      ? supabase
          .from("daily_feedbacks")
          .select("id")
          .eq("date", jstTodayStr())
          .eq("status", "sent")
          .limit(1)
      : Promise.resolve(null),
    showCeleb ? getTodayActivity() : Promise.resolve(null),
    showCeleb ? getRecordStreak() : Promise.resolve(0),
  ]);
  // 件0(2026-07-13): 編集ロックは「その日の実施記録が存在し(completedToday)、かつ当日FBがある」時だけ。
  //   未記録の日はFBの有無に関係なく通常の記録フロー(強度・完了)を出す(点7の実装誤りを修正)。
  const feedbackLocked = w.completedToday && (fbRes?.data?.length ?? 0) > 0;
  const doneCount = act
    ? (act.learned ? 1 : 0) + (act.recordedMeal ? 1 : 0) + (act.recordedWorkout ? 1 : 0)
    : 0;
  const prog = showCeleb ? w.progress : null;
  const nextLabel =
    prog && w.cycles
      ? nextDayLabel(w.cycles, prog.cycleNumber, prog.currentDay)
      : null;

  // T3: 完了直後(?done=1)だけ祝福専用画面。編集UI/種目リスト/下部ナビは出さない
  // (下ナビは /workout/today で既に非表示)。リロード/再訪では ?done=1 が消え通常の完了済みビューへ。
  if (showCeleb) {
    // 仮反映(preview): 完了画面をフルスクリーン化(ヘッダー枠・戻る撤去)。非preview は現行どおり。
    return (
      <>
        {!preview && <MemberHeader title="今日のトレーニング" fallbackHref="/" />}
        <WorkoutDoneCelebration
          streakDays={streakDays}
          doneCount={doneCount}
          nextLabel={nextLabel}
        />
      </>
    );
  }

  // 仮反映: きよむ + 開始済み + メニューあり の時だけ新実施記録V2(自前で main を持つ)。
  if (preview && w.started && w.hasMenu && w.cycles) {
    return (
      <>
        <MemberHeader title="今日のトレーニング" fallbackHref="/" />
        <WorkoutTodayClientV2
          cycles={w.cycles}
          dayNumber={w.dayNumber}
          cycleNumber={w.cycleNumber}
          initialIntensity={w.todayLog?.intensity ?? "medium"}
          alreadyDone={w.todayLog?.status === "done" || w.todayLog?.status === "rest_done"}
          initialMemo={w.todayLog?.memo ?? null}
          completedAtLabel={
            w.todayLog?.completedAt
              ? new Date(new Date(w.todayLog.completedAt).getTime() + 9 * 3600 * 1000)
                  .toISOString()
                  .slice(11, 16)
              : null
          }
          feedbackLocked={feedbackLocked}
        />
      </>
    );
  }

  return (
    <>
      <MemberHeader title="今日のトレーニング" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
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
      <div
        className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-[460px]">
          <StartWorkoutButton />
        </div>
      </div>
    </div>
  );
}
