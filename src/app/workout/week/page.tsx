import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";
import { jstTodayStr } from "@/lib/date/jst";
import { WeekGridCard } from "./WeekGridCard";
import { DraftGate } from "./DraftGate";

export const dynamic = "force-dynamic";

/**
 * 週間トレ・メイン(再設計・モック画面1/7・3人先行)。
 * 未完了=メイン初期画面 / 決定済み未完了=表紙へ(DraftGate) / 完了済=完了後メイン。
 */
export default async function WeekPoolPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const wk = await getWeeklyTraining();
  const todayKey = jstTodayStr();

  return (
    <>
      <MemberHeader title={`今週のトレーニング ・ ${wk.weekNumber}週目`} fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {!wk.hasMenu ? (
            <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-8 text-center text-[13px] leading-relaxed text-[#6a6256]">
              まだトレーニングメニューが届いていません。
              <br />
              のりが準備中です（通常1〜3日）。少しお待ちください。
            </div>
          ) : wk.todayDone ? (
            // ---- 完了後メイン(§2-7) ----
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-[#e7dcc9] bg-white px-4 py-4 text-center">
                <div className="text-[10px] font-extrabold text-[#a59b8c]">{mdToday(todayKey)}</div>
                <div className="my-1 text-[14.5px] font-extrabold text-[#34603f]">今日のトレーニングは完了しました</div>
                <div className="mb-3 text-[11.5px] font-bold text-[#6a6256]">
                  {wk.todayLabel}
                  {wk.todayArranged ? "（一部アレンジ）" : ""}
                  {wk.todayExCount > 0 ? ` ・ ${wk.todayExCount}種目` : ""}
                </div>
                {wk.todayLogId && (
                  <Link
                    href={`/workout/week/edit?edit=${wk.todayLogId}&from=main`}
                    className="block rounded-lg border-2 border-[#4a875b] py-2.5 text-[12px] font-extrabold text-[#34603f]"
                  >
                    内容を修正する
                  </Link>
                )}
              </div>

              <WeekGridCard recRow={wk.recRow} thisRow={wk.thisRow} lastRow={wk.lastRow} remaining={wk.remaining} />

              <Link
                href="/workout/week/select"
                className="block rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f] opacity-90"
              >
                別のメニューを選ぶ
              </Link>
              <p className="text-center text-[10px] text-[#a59b8c]">（もう1回やりたい日もここから）</p>
            </div>
          ) : (
            // ---- メイン初期画面(§2-1) ----
            <div className="flex flex-col gap-3">
              <DraftGate todayKey={todayKey} />
              <p className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-[#34603f]">
                1週間で全部を1回ずつ、が目安です。順番も組み合わせも自由。迷ったら上から順でOK。
              </p>

              <WeekGridCard recRow={wk.recRow} thisRow={wk.thisRow} lastRow={wk.lastRow} remaining={wk.remaining} />

              {wk.nextRecommended ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3">
                    <span
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[13px] font-extrabold text-white"
                      style={{ background: wk.nextRecommended.kind === "rest" ? "#b6a35c" : wk.nextRecommended.color }}
                    >
                      {wk.nextRecommended.abbr}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9.5px] font-extrabold text-[#a5631f]">次のおすすめ</div>
                      <div className="text-[15px] font-extrabold text-[#2b2620]">{wk.nextRecommended.name}</div>
                    </div>
                    {wk.nextRecommended.kind !== "rest" && (
                      <span className="text-[10px] font-bold text-[#6a6256]">{wk.nextRecommended.exCount}種目</span>
                    )}
                  </div>
                  {wk.nextRecommended.kind === "rest" ? (
                    <Link
                      href={`/workout/week/confirm?rest=1&day=${wk.nextRecommended.index}`}
                      className="block rounded-xl py-3 text-center text-[14px] font-bold text-white"
                      style={{ background: "#b6a35c", boxShadow: "0 4px 0 #96854a" }}
                    >
                      今日は休養日にする
                    </Link>
                  ) : (
                    <Link
                      href={`/workout/week/edit?day=${wk.nextRecommended.index}&from=main`}
                      className="btn3d block rounded-xl py-3 text-center text-[14px] font-bold"
                    >
                      そのまま始める
                    </Link>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-[#cfe3d6] bg-[#eaf3ec] px-3.5 py-3 text-center text-[13px] font-bold text-[#34603f]">
                  今週のおすすめメニューは全部やりました。お疲れさまです。
                </div>
              )}

              <Link
                href="/workout/week/select"
                className="block rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f]"
              >
                別のメニューを選ぶ
              </Link>
              <Link
                href="/workout/week/edit?from=main"
                className="block rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f]"
              >
                自分のメニューを組む（1から）
              </Link>

              <div className="flex justify-center gap-6 py-1 text-[11.5px] font-extrabold text-[#34603f]">
                <Link href="/workout/week/menus">じぶんメニュー棚 →</Link>
                <Link href="/workout/week/last">先週から選ぶ →</Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function mdToday(d: string): string {
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${d}T00:00:00+09:00`).getDay()];
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${wd}）`;
}
