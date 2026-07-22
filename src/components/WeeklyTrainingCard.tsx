import Link from "next/link";
import type { WeeklyTraining } from "@/lib/workout/weekly";

/**
 * ホーム「今日やること」トレカード(週間プール・モック画面1)。
 * 既存 TodayCard の見た目に合わせつつ、内容を週間表示に。藤田先行ゲート時のみ表示。
 * 「今週のトレーニング / 残り◯メニュー（今日はまだ） / ▶今日のメニューを選ぶ→」。
 * 実施済みの日は「今日は◯◯をやりました✓」＋残り数。
 */
const CAP_COLOR = "#5b7a9d";

export function WeeklyTrainingCard({ weekly }: { weekly: WeeklyTraining }) {
  const done = weekly.todayDone;
  const noMenu = !weekly.hasMenu;
  const title = noMenu
    ? "メニューが届くのをお待ちください"
    : done
      ? `今日は ${weekly.todayLabel ?? "トレーニング"} をやりました`
      : `残り ${weekly.remaining} メニュー（今日はまだ）`;
  const sub = !noMenu && done ? `今週の残り ${weekly.remaining} メニュー` : null;

  return (
    <Link
      href="/workout/week"
      className={`block rounded-2xl bg-[#fffdf8] px-[15px] py-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] font-extrabold ${
            done ? "bg-[#2f9e5a] text-white" : "border-2 border-[#c9bfa9] text-transparent"
          }`}
        >
          ✓
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold" style={{ color: CAP_COLOR }}>
            今週のトレーニング
          </div>
          <div className="mt-0.5 truncate text-[15px] font-extrabold text-[#1c1a16]">
            {title}
          </div>
          {done ? (
            sub && <div className="mt-0.5 text-[11px] font-bold text-[#6a6256]">{sub}</div>
          ) : (
            !noMenu && (
              <div className="mt-1 text-[12px] font-extrabold" style={{ color: CAP_COLOR }}>
                ▶ 今日のメニューを選ぶ →
              </div>
            )
          )}
        </div>
      </div>
    </Link>
  );
}
