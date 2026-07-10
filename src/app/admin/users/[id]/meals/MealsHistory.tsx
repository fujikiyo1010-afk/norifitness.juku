"use client";

import { useState } from "react";
import type { AdminMealDay } from "@/lib/admin/meals";

const MEAL_LABEL: Record<string, string> = {
  朝: "朝食",
  昼: "昼食",
  夕: "夕食",
  間: "間食",
};

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

export function MealsHistory({ days }: { days: AdminMealDay[] }) {
  const [open, setOpen] = useState<string | null>(days[0]?.date ?? null);

  return (
    <div className="space-y-2">
      {days.map((day) => {
        const isOpen = open === day.date;
        const types = day.meals.map((m) => m.mealType);
        return (
          <div
            key={day.date}
            className="overflow-hidden rounded-2xl border border-[#e8ebe9] bg-white"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : day.date)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-zinc-900">
                  {dateLabel(day.date)}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {["朝", "昼", "夕", "間"]
                    .map((t) => (types.includes(t) ? t : "・"))
                    .join(" ")}
                </span>
                {day.feedback && (
                  <span className="h-2 w-2 rounded-full bg-[#4a875b]" title="FB送信済み" />
                )}
              </span>
              <span className="text-[11px] text-zinc-400">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="space-y-2 border-t border-[#eef1f0] bg-[#fafbfb] px-4 py-3">
                {day.meals.map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {m.photoUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photoUrls[0]}
                        alt=""
                        className="h-14 w-14 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400">
                        写真なし
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-bold text-zinc-900">
                          {MEAL_LABEL[m.mealType] ?? m.mealType}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {timeLabel(m.postedAt)}
                        </span>
                      </div>
                      {m.items.length > 0 && (
                        <div className="text-[11px] text-zinc-600">
                          {m.items.join("、")}
                        </div>
                      )}
                      {m.memo && (
                        <div className="text-[11px] italic text-zinc-400">{m.memo}</div>
                      )}
                    </div>
                  </div>
                ))}

                {day.feedback && (
                  <div className="mt-2 rounded-lg border border-[#d7e6db] bg-[#eef5f0] px-3 py-2">
                    <div className="mb-0.5 text-[10px] font-bold text-[#34603f]">
                      この日に送ったデイリーFB
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-700">
                      {day.feedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
