import type { SeriesPoint } from "@/lib/monthly-audit/series";
import { formatShortMonth } from "@/lib/monthly-audit/series";

/**
 * 軽量 sparkline (自前 SVG、ライブラリ非依存)
 *
 * 設計方針:
 *   - 5 ヶ月分のデータ + 月ラベルを横並びで表示
 *   - 欠損 (null) は折れ線を「途切れ」として表現
 *   - 最新点を太いドット、それ以外は細いドット
 *   - Y 軸は自動スケール (最小値〜最大値、padding なし)
 *   - 全データ null なら「データなし」表示
 */
export function Sparkline({
  series,
  unit,
  width = 320,
  height = 60,
  color = "#00897b",
}: {
  series: SeriesPoint[];
  unit: string;
  width?: number;
  height?: number;
  color?: string;
}) {
  const validValues = series
    .map((p) => p.value)
    .filter((v): v is number => v !== null);

  if (validValues.length === 0) {
    return (
      <div
        className="rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500"
        style={{ width, height: height + 24 }}
      >
        まだデータがありません
      </div>
    );
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max === min ? 1 : max - min;

  const padX = 16;
  const padTop = 8;
  const padBottom = 8;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const stepX =
    series.length > 1 ? innerW / (series.length - 1) : 0;

  // 各点の座標
  const points = series.map((p, i) => {
    if (p.value === null) return null;
    const x = padX + stepX * i;
    const y = padTop + innerH - ((p.value - min) / range) * innerH;
    return { x, y, value: p.value };
  });

  // 折れ線 (null で途切れる)
  const pathSegments: string[] = [];
  let currentSeg = "";
  for (const pt of points) {
    if (pt === null) {
      if (currentSeg) pathSegments.push(currentSeg);
      currentSeg = "";
    } else {
      currentSeg += currentSeg ? ` L ${pt.x} ${pt.y}` : `M ${pt.x} ${pt.y}`;
    }
  }
  if (currentSeg) pathSegments.push(currentSeg);

  return (
    <div className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* 折れ線 */}
        {pathSegments.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* ドット (最新だけ大きく) */}
        {points.map((pt, i) => {
          if (pt === null) return null;
          const isLast =
            i === points.length - 1 ||
            !points.slice(i + 1).some((p) => p !== null);
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={isLast ? 4 : 2.5}
              fill={color}
              stroke="white"
              strokeWidth={isLast ? 1.5 : 0}
            />
          );
        })}
      </svg>
      {/* 月ラベル */}
      <div
        className="flex justify-between text-[9px] text-zinc-400 font-mono"
        style={{ paddingLeft: padX, paddingRight: padX }}
      >
        {series.map((p, i) => (
          <span key={i}>{formatShortMonth(p.targetMonth)}</span>
        ))}
      </div>
      {/* 単位の補足 (右端) */}
      <div className="mt-1 text-right text-[9px] text-zinc-400">
        {min}〜{max} {unit}
      </div>
    </div>
  );
}
