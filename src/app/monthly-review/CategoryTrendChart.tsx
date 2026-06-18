import type { CategoryTrendSeries } from "@/lib/monthly-audit/aggregations";

/**
 * カテゴリ別 月次推移 グラフ (#4 採用 ・ 2026-06-17 きよむさん指示)
 *
 * 4 カテゴリ (食事 / 運動 / 休息 / マインド・学習) × 月数 の折れ線。
 * 「どのカテゴリが伸びてるか、 落ちてるか」 を直感的に把握 → のりfitness 思想と整合。
 *
 * - 1 件 = 単独点
 * - 2 件以上 = 折れ線
 * - null (全項目未記入) は点表示 skip
 */

const WIDTH = 360;
const HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 30, left: 32 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

const MIN_SCALE = 0;
const MAX_SCALE = 10;

const CATEGORY_COLORS: Record<string, string> = {
  diet: "#16a34a", // 食事 = 緑
  exercise: "#ea580c", // 運動 = オレンジ
  rest: "#2563eb", // 休息 = 青
  mind_learning: "#7c3aed", // マインド・学習 = 紫
};

export function CategoryTrendChart({
  series,
}: {
  series: CategoryTrendSeries[];
}) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div className="text-center text-[12px] text-[#6a6256] py-8">
        提出済みの月次添削がまだありません
      </div>
    );
  }

  const months = allPoints[0]
    ? series[0].points.map((p) => p.monthLabel)
    : [];

  const yTicks = [10, 7.5, 5, 2.5, 0];
  const span = MAX_SCALE - MIN_SCALE;

  function yOf(v: number) {
    return PADDING.top + (1 - (v - MIN_SCALE) / span) * CHART_H;
  }

  function xOf(idx: number, total: number) {
    if (total <= 1) return PADDING.left + CHART_W / 2;
    return PADDING.left + (idx / (total - 1)) * CHART_W;
  }

  const seriesPaths = series.map((s) => {
    const validPoints = s.points
      .map((p, idx) => (p.average !== null ? { idx, value: p.average } : null))
      .filter((p): p is { idx: number; value: number } => p !== null)
      .map((p) => ({
        x: xOf(p.idx, s.points.length),
        y: yOf(p.value),
        v: p.value,
      }));

    const linePath =
      validPoints.length > 0
        ? validPoints
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ")
        : "";

    return {
      category: s.category,
      label: s.label,
      color: CATEGORY_COLORS[s.category] ?? "#666",
      linePath,
      points: validPoints,
    };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        {/* グリッド */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={PADDING.left}
            x2={PADDING.left + CHART_W}
            y1={yOf(t)}
            y2={yOf(t)}
            stroke="#f3f4f6"
            strokeWidth="1"
            strokeDasharray={t === 0 ? "0" : "2,3"}
          />
        ))}

        {/* Y 軸ラベル */}
        {yTicks.map((t, i) => (
          <text
            key={`y-${i}`}
            x={PADDING.left - 4}
            y={yOf(t) + 3}
            textAnchor="end"
            fill="#6b7280"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
          >
            {t}
          </text>
        ))}

        {/* 4 カテゴリの折れ線 */}
        {seriesPaths.map((s) => (
          <g key={s.category}>
            {s.linePath && s.points.length >= 2 ? (
              <path
                d={s.linePath}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {s.points.map((p, i) => (
              <circle
                key={`d-${s.category}-${i}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill="white"
                stroke={s.color}
                strokeWidth="2"
              />
            ))}
          </g>
        ))}

        {/* X 軸ラベル */}
        {months.map((label, i) => (
          <text
            key={`xl-${i}`}
            x={xOf(i, months.length)}
            y={HEIGHT - 14}
            textAnchor="middle"
            fill="#6b7280"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* 凡例 (4 カテゴリ) */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
        {seriesPaths.map((s) => (
          <div
            key={`legend-${s.category}`}
            className="flex items-center gap-1.5 text-[10px] text-zinc-600"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border-2 bg-[#fffdf8]"
              style={{ borderColor: s.color }}
            />
            <span className="font-bold">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
