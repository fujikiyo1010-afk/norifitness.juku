import type { CategoryAverage } from "@/lib/monthly-audit/aggregations";

/**
 * カテゴリ別スコア ブロック (2026-06-17 線① 1 件目から表示対応)
 *
 * 4 カテゴリ (食事 / 運動 / 休息 / マインド・学習) の平均スコア (0-10) を 横棒で。
 * 全項目未記入のカテゴリは「—」 表示。
 */
export function CategoryScoresBlock({
  averages,
}: {
  averages: CategoryAverage[];
}) {
  return (
    <div className="space-y-2.5">
      {averages.map((a) => {
        const filled = a.average !== null;
        const pct = filled ? Math.min((a.average! / 10) * 100, 100) : 0;
        return (
          <div key={a.category}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] text-zinc-700 font-bold">
                {a.label}
              </span>
              <span className="text-[12px] font-bold text-[#34603f] font-mono">
                {filled ? (
                  <>
                    {a.average!.toFixed(1)}
                    <span className="text-[9px] text-[#a59b8c] ml-0.5">/10</span>
                  </>
                ) : (
                  <span className="text-[#a59b8c]">—</span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4a875b] to-[#34603f] rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
