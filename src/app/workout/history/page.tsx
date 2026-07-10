import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getMyWorkoutHistory } from "@/lib/workout/logs";
import { INTENSITY_LABEL } from "@/lib/workout/logs-types";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  done: { label: "完了", cls: "text-[#34603f] bg-[#eef5f0]" },
  rest_done: { label: "休養", cls: "text-[#3a6ea5] bg-[#e8f0fa]" },
  skipped: { label: "未実施", cls: "text-[#b0640f] bg-[#fdece0]" },
};

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}

/** トレ履歴(M10・受講生・ベータ) */
export default async function WorkoutHistoryPage() {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/workout");

  const h = await getMyWorkoutHistory();

  return (
    <>
      <MemberHeader title="トレーニング履歴" fallbackHref="/workout/today" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {/* サマリー */}
          <div className="mb-3 flex rounded-2xl border border-[#e7dcc9] bg-[#fffdf8]">
            <Metric value={h.thisWeek} unit="回" label="今週" />
            <Metric value={h.thisMonth} unit="回" label="今月" divider />
            <Metric value={h.cycleNumber} unit="周目" label="いま" divider />
            <Metric value={h.totalDone} unit="回" label="のべ完了" divider />
          </div>

          {h.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] p-8 text-center text-[13px] text-[#6a6256]">
              まだトレーニングの記録はありません。
            </div>
          ) : (
            <ul className="space-y-1.5">
              {h.rows.map((r, i) => {
                const st = STATUS[r.status] ?? STATUS.done;
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-2.5 ${
                      r.status === "skipped" ? "opacity-70" : ""
                    }`}
                  >
                    <div className="w-16 flex-shrink-0 text-[11px] font-bold text-[#6a6256]">
                      {dateLabel(r.date)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-[#2b2620]">
                        {r.cycleNumber}周{r.dayNumber}日目
                        {r.addedCount > 0 && (
                          <span className="ml-1 text-[10px] font-bold text-[#4a875b]">
                            ＋{r.addedCount}追加
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#a59b8c]">
                        {INTENSITY_LABEL[r.intensity]}強度
                        {r.itemCount > 0 ? `・${r.itemCount}種目` : ""}
                        {r.hasMemo ? "・メモあり" : ""}
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function Metric({
  value,
  unit,
  label,
  divider = false,
}: {
  value: number;
  unit: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <div className={`flex-1 py-2.5 text-center ${divider ? "border-l border-[#f0ead9]" : ""}`}>
      <div className="text-[16px] font-extrabold text-[#34603f]">
        {value}
        <span className="text-[9px] font-semibold text-[#a59b8c]">{unit}</span>
      </div>
      <div className="mt-px text-[9px] font-bold text-[#6a6256]">{label}</div>
    </div>
  );
}
