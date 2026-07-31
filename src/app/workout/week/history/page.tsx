import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { isCalendarUser } from "@/lib/auth/calendar-gate";
import { getBackdateList, type BackdateDay } from "@/lib/workout/backdate-list";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { resolveDayMenu, INTENSITY_LABEL, type Intensity } from "@/lib/workout/logs-types";
import { getExerciseTarget } from "@/lib/workout/menu-display";
import type { WorkoutCycles } from "@/lib/workout/types";

export const dynamic = "force-dynamic";

/**
 * トレ記録の一覧・過去日を追加(バックデート・2026-07-31)。
 * カレンダーのトレカードから入る(案あ-2)。カレンダーと同じ 4人ゲート(月曜に全開放)。
 * ベージュ・週ごと1ブロック(スタイルB)・全日表示・抜け日タップで追加・記録行タップで編集。
 */

/** その日のテーマ名(◯◯の日/休養日/パーソナル)。プール行(cycle=NULL)の見出し用。 */
function dayThemeLabel(cycles: WorkoutCycles | null, intensity: Intensity, day: number): string {
  if (!cycles) return `${day}日目`;
  const dm = resolveDayMenu(cycles, intensity, day);
  if (!dm) return `${day}日目`;
  if (dm.種別 === "休息") return "休養日";
  if (dm.種別 === "パーソナル") return "パーソナル";
  const ex = (dm.種目 ?? []).filter((e) => e.種目名);
  const t = getExerciseTarget(ex.flatMap((e) => e.主部位 ?? []));
  return dm.日 && dm.日 !== `${day}日目` ? dm.日 : t && t !== "全身" ? `${t}の日` : "トレーニング";
}

function doneTitle(cycles: WorkoutCycles | null, d: BackdateDay): string {
  if (d.isCustom) return `じぶんメニュー${d.primaryTarget ? `（${d.primaryTarget}）` : ""}`;
  if (d.cycleNumber != null && d.dayNumber != null) return `${d.cycleNumber}周${d.dayNumber}日目`;
  if (d.dayNumber != null) return dayThemeLabel(cycles, d.intensity, d.dayNumber);
  return "トレーニング";
}

export default async function WeekBackdateHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const [isPool, isCal] = await Promise.all([isWeeklyPoolUser(), isCalendarUser()]);
  if (!isPool || !isCal) redirect("/workout/week");

  const sp = await searchParams;
  const reqDays = Number(sp.days);
  const windowDays = Number.isFinite(reqDays) && reqDays >= 30 && reqDays <= 400 ? Math.floor(reqDays) : 30;

  const [list, menu] = await Promise.all([getBackdateList(windowDays), getMyCurrentMenu()]);
  const cycles = menu?.cycles ?? null;

  return (
    <>
      <MemberHeader title="トレ記録の一覧" fallbackHref="/calendar" />
      <main className="min-h-[100dvh] bg-[#e9e2d4]">
        <div className="mx-auto max-w-[460px] px-3.5 py-4 pb-24">
          <p className="mb-3 px-1 text-[11px] leading-relaxed text-[#6a6256]">
            日付をタップすると記録できます。抜けている日（記録がない日）も、あとから追加できます。
          </p>

          {list.weeks.length === 0 ? (
            <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-8 text-center text-[13px] text-[#6a6256]">
              表示できる日がありません。
            </div>
          ) : (
            list.weeks.map((w) => (
              <div key={w.days[0]?.date ?? w.label}>
                <div className="mt-3.5 mb-1.5 flex items-center gap-2 px-0.5 text-[10.5px] font-extrabold text-[#a59b8c] first:mt-0.5">
                  <span>{w.label}</span>
                  {w.range && <span className="font-bold text-[#bcb2a1]">{w.range}</span>}
                  <span className="h-px flex-1 bg-[#eadfce]" />
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#fffdf8]">
                  {w.days.map((d) => (
                    <Row key={d.date} d={d} cycles={cycles} />
                  ))}
                </div>
              </div>
            ))
          )}

          {list.hasMore && (
            <Link
              href={`/workout/week/history?days=${list.nextDays}`}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#dcd2bd] bg-[#fffdf8] px-3 py-3 text-[12.5px] font-extrabold text-[#6a6256]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              さらに過去を見る（入会日まで）
            </Link>
          )}
        </div>
      </main>
    </>
  );
}

/** 1日分の行(高さ揃え=常に2行相当)。記録あり=編集へ / 抜け日=追加へ。 */
function Row({ d, cycles }: { d: BackdateDay; cycles: WorkoutCycles | null }) {
  const dt = (
    <span className="w-[62px] flex-none text-[11px] font-extrabold text-[#6a6256]">
      {d.date.slice(5).replace("-", "/")}
      <span className="ml-0.5 font-bold text-[#a59b8c]">({d.weekday})</span>
    </span>
  );

  if (d.kind === "gap") {
    return (
      <Link
        href={`/workout/week/select?date=${d.date}`}
        className="flex min-h-[56px] items-center gap-2.5 border-t border-[#f0e9db] bg-[#fdf8ec] px-3.5 py-2.5 first:border-t-0"
      >
        {dt}
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block text-[12.5px] font-extrabold text-[#b58a3c]">記録がありません</b>
          <span className="text-[10px] text-[#a59b8c]">タップで記録できます</span>
        </div>
        <span className="flex-none text-[12px] font-extrabold text-[#34603f]">＋ 追加</span>
      </Link>
    );
  }

  const isRest = d.kind === "rest";
  const isSkip = d.kind === "skipped";
  const title = isRest ? "休養日" : isSkip ? "未実施" : doneTitle(cycles, d);
  const sub = isRest
    ? d.isSelfRest
      ? "本人が設定した休養"
      : "回復日"
    : isSkip
      ? "この日はスキップ"
      : `${INTENSITY_LABEL[d.intensity]}強度${d.itemCount > 0 ? `・${d.itemCount}種目` : ""}${d.addedCount > 0 ? ` ＋${d.addedCount}追加` : ""}`;
  const badge = isRest
    ? { label: "休養", cls: "text-[#3a6ea5] bg-[#e8f0fa]" }
    : isSkip
      ? { label: "未実施", cls: "text-[#b0640f] bg-[#fdece0]" }
      : { label: "完了", cls: "text-[#34603f] bg-[#eef5f0]" };

  return (
    <Link
      href={`/workout/week/edit?edit=${d.logId}&date=${d.date}&from=list`}
      className="flex min-h-[56px] items-center gap-2.5 border-t border-[#f0e9db] px-3.5 py-2.5 first:border-t-0"
    >
      {dt}
      <div className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-[12.5px] font-extrabold text-[#2b2620]">{title}</b>
        <span className="block truncate text-[10px] text-[#a59b8c]">{sub}</span>
      </div>
      <span className={`flex-none rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${badge.cls}`}>{badge.label}</span>
      <span className="flex-none text-[15px] text-[#a59b8c]">›</span>
    </Link>
  );
}
