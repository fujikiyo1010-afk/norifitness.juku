import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { jstTodayStr } from "@/lib/date/jst";
import { ConfirmClient } from "./ConfirmClient";
import { FlowLeaveGuard } from "../FlowLeaveGuard";

export const dynamic = "force-dynamic";

/**
 * 今日のトレーニングの表紙(§2-6)。決定内容は端末ローカル(ConfirmClient が読む)。
 * ?rest=1&day=N: 休養日直行(セット表を通らない・§2-8)。
 */
export default async function WeekConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ rest?: string; day?: string; date?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;
  const rest = sp.rest === "1";
  const restDayNumber = rest && sp.day ? Number(sp.day) : null;
  // 過去日記録(バックデート): 対象日。無ければ今日。todayKey(下書き名前空間)も対象日で分離。
  const targetDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= jstTodayStr() ? sp.date : null;
  const flowKey = targetDate ?? jstTodayStr();
  const backHref = targetDate ? "/workout/week/history" : "/workout/week";

  return (
    <>
      <MemberHeader title={targetDate ? "過去の日の記録" : "今日のトレーニング"} fallbackHref={backHref} />
      {/* ②-B: 休養日以外は離脱時に破棄確認。戻り先=来た入口。 */}
      <FlowLeaveGuard active={!rest} backHref={backHref} todayKey={flowKey} />
      <ConfirmClient
        todayKey={flowKey}
        date={targetDate}
        rest={rest}
        restDayNumber={Number.isFinite(restDayNumber) ? restDayNumber : null}
      />
    </>
  );
}
