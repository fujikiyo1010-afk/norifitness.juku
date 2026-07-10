import { redirect } from "next/navigation";
import Link from "next/link";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getTodayWorkout } from "@/lib/workout/logs";
import { resolveDayMenu } from "@/lib/workout/logs-types";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { WorkoutTodayClient } from "./WorkoutTodayClient";
import { StartWorkoutButton } from "./StartWorkoutButton";

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

  return (
    <>
      <MemberHeader title="今日のトレーニング" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {sp.done === "1" && (
            <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#4a875b] to-[#34603f] px-4 py-5 text-center text-white">
              <div className="text-[28px] font-extrabold">✓</div>
              <div className="mt-1 text-[15px] font-bold">記録しました！</div>
              <div className="mt-0.5 text-[12px] opacity-90">
                今日の達成に反映されます。おつかれさまでした。
              </div>
              <Link
                href="/"
                className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-[12px] font-bold"
              >
                ホームに戻る →
              </Link>
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
