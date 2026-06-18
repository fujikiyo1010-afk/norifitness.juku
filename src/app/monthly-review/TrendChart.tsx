import type { TrendPoint } from "@/lib/monthly-audit/aggregations";

/**
 * 月次推移 折れ線グラフ (2026-06-17 線① 1 件目から表示対応)
 *
 * - 0 件 → 「まだデータがありません」
 * - 1 件 → 単独点表示
 * - 2 件以上 → 折れ線
 */

const WIDTH = 360;
const HEIGHT = 180;
const PADDING = { top: 12, right: 16, bottom: 28, left: 32 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

const MIN_SCALE = 0;
const MAX_SCALE = 10;

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="text-center text-[12px] text-[#6a6256] py-8">
        提出済みの月次添削がまだありません
      </div>
    );
  }

  const yTicks = [10, 7.5, 5, 2.5, 0];
  const span = MAX_SCALE - MIN_SCALE;

  function yOf(v: number) {
    return PADDING.top + (1 - (v - MIN_SCALE) / span) * CHART_H;
  }

  function xOf(idx: number) {
    if (trend.length === 1) return PADDING.left + CHART_W / 2;
    return PADDING.left + (idx / (trend.length - 1)) * CHART_W;
  }

  const points = trend.map((p, idx) => ({
    x: xOf(idx),
    y: yOf(p.average),
    label: p.monthLabel,
    value: p.average,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
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
          fill="#34603f"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {t}
        </text>
      ))}

      {/* 折れ線 (2 点以上) */}
      {points.length >= 2 ? (
        <path
          d={linePath}
          fill="none"
          stroke="#4a875b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* ドット + 値ラベル */}
      {points.map((p, i) => (
        <g key={`d-${i}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4.5"
            fill="white"
            stroke="#4a875b"
            strokeWidth="2.5"
          />
          <text
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            fill="#34603f"
            fontSize="10"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
          >
            {p.value.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X 軸ラベル */}
      {points.map((p, i) => (
        <text
          key={`xl-${i}`}
          x={p.x}
          y={HEIGHT - 8}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
