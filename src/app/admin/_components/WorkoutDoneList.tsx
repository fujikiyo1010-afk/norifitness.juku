import type { AdminDoneExercise } from "@/lib/admin/workout-sets";

/**
 * 管理トレ記録「やった種目」表示(変種A・2026-07-24)。
 * 種目ごとにカード、各セットを 重量×回数 のチップで(kgは黒・追加種目は紫・自重は「自重」・回数空は「未入力」)。
 * デイリー添削 と ユーザーハブ で共用。
 */
export function WorkoutDoneList({
  exercises,
  totalVolume,
  notDoneNames,
}: {
  exercises: AdminDoneExercise[];
  totalVolume: number;
  notDoneNames: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {exercises.length > 0 && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold text-[#34603f]">やった（{exercises.length}種目）</span>
            {totalVolume > 0 && (
              <span className="text-[10.5px] font-bold text-zinc-500">
                総ボリューム {totalVolume.toLocaleString()}kg
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {exercises.map((ex, i) => (
              <div
                key={`${ex.name}-${i}`}
                className={`rounded-lg border px-2.5 py-2 ${
                  ex.added ? "border-[#d9ccf6] bg-[#f4effc]" : "border-zinc-200 bg-white"
                }`}
              >
                <div className={`text-[12.5px] font-bold ${ex.added ? "text-[#5b3fd6]" : "text-zinc-800"}`}>
                  {ex.name}
                  {ex.added && (
                    <span className="ml-1.5 rounded-full border border-[#7a5af0] px-1.5 text-[9px] font-extrabold text-[#5b3fd6]">
                      追加
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ex.sets.map((s, si) => {
                    const missing = s.reps == null;
                    return (
                      <span
                        key={si}
                        className={`inline-flex items-baseline gap-1 rounded-md px-2 py-0.5 text-[11.5px] tabular-nums ${
                          missing
                            ? "bg-[#fdeee7] text-[#b0501f]"
                            : ex.added
                              ? "bg-[#efe9fb] text-zinc-800"
                              : "bg-[#f4f4f5] text-zinc-800"
                        }`}
                      >
                        <i className="text-[9px] not-italic font-bold text-zinc-400">{si + 1}</i>
                        {missing ? (
                          <span className="font-bold">回数 未入力</span>
                        ) : (
                          <>
                            <b className="font-extrabold">{s.kg != null ? `${s.kg}kg` : "自重"}</b>
                            <span className="text-zinc-400">×</span>
                            <b className="font-extrabold">{s.reps}</b>
                            <i className="text-[9px] not-italic font-bold text-zinc-400">回</i>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {notDoneNames.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-[#b0640f]">やらなかった：</span>
          <span className="text-zinc-400 line-through">{notDoneNames.join("、")}</span>
        </div>
      )}
    </div>
  );
}
