import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { jstTodayStr } from "@/lib/date/jst";
import { ConfirmClient } from "./ConfirmClient";

export const dynamic = "force-dynamic";

/**
 * 今日のトレーニングの表紙(§2-6)。決定内容は端末ローカル(ConfirmClient が読む)。
 * ?rest=1&day=N: 休養日直行(セット表を通らない・§2-8)。
 */
export default async function WeekConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ rest?: string; day?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;
  const rest = sp.rest === "1";
  const restDayNumber = rest && sp.day ? Number(sp.day) : null;

  return (
    <>
      <MemberHeader title="今日のトレーニング" fallbackHref="/workout/week" />
      <ConfirmClient
        todayKey={jstTodayStr()}
        rest={rest}
        restDayNumber={Number.isFinite(restDayNumber) ? restDayNumber : null}
      />
    </>
  );
}
