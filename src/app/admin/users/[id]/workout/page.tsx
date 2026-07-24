import { getWorkoutHistoryForUser } from "@/lib/admin/workout";
import { WorkoutDoneList } from "@/app/admin/_components/WorkoutDoneList";

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

/** 管理 受講生ハブ ・ トレ記録タブ(M3・P5・原本×実績差分) */
export default async function UserWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const h = await getWorkoutHistoryForUser(userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3 flex gap-4 text-[12px] text-zinc-500">
        <span>
          いま <b className="text-zinc-900">{h.cycleNumber}</b> 周目
        </span>
        <span>
          今月 <b className="text-zinc-900">{h.thisMonthDone}</b> 回
        </span>
        <span>
          のべ完了 <b className="text-zinc-900">{h.totalDone}</b> 回
        </span>
      </div>

      {h.days.length === 0 ? (
        <div className="rounded-2xl border border-[#e8ebe9] bg-white p-8 text-center text-[13px] text-zinc-500">
          まだトレーニングの記録はありません。
          <div className="mt-1.5 text-[11px] text-zinc-400">
            受講生がトレを記録すると、ここに日別で表示されます。
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {h.days.map((d, i) => {
            const st = STATUS[d.status] ?? STATUS.done;
            return (
              <div
                key={i}
                className={`rounded-2xl border border-[#e8ebe9] bg-white px-4 py-3 ${
                  d.status === "skipped" ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-zinc-500">
                    {dateLabel(d.date)}
                  </span>
                  <span className="text-[13px] font-bold text-zinc-900">{d.dayLabel}</span>
                  {d.performedDayLabel && (
                    <span className="rounded bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-bold text-[#8a6d1a]">
                      実施：{d.performedDayLabel}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400">{d.intensityLabel}強度</span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}
                  >
                    {st.label}
                  </span>
                </div>
                {d.status === "rest_done" && d.isSelfRest && (
                  <div className="mt-1 inline-block rounded bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-bold text-[#8a6d1a]">
                    本人が休養日に設定
                  </div>
                )}
                <div className="mt-1.5 space-y-1 text-[11.5px]">
                  {(d.doneExercises.length > 0 || d.notDoneNames.length > 0) && (
                    <WorkoutDoneList
                      exercises={d.doneExercises}
                      totalVolume={d.totalVolume}
                      notDoneNames={d.notDoneNames}
                    />
                  )}
                  {d.memo && (
                    <div className="text-[11px] italic text-zinc-400">「{d.memo}」</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
