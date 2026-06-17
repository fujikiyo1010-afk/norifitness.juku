"use client";

import { useMemo } from "react";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import type { MetricKey } from "./BodyMetricsHero";

/**
 * 体組成 折れ線グラフ ・ SVG 自前実装 (2026-06-17 v2 ・ 3-way 単一指標)
 *
 * 描画要素:
 *   - 選択中指標 (体重 / 体脂肪率 / ウエスト) の折れ線 1 本
 *   - 目標線: 体重選択時のみ ・ target_weight_kg を緑破線
 *   - X 軸: 日付ラベル / Y 軸: 単位ラベル (左のみ)
 *
 * ライブラリ不採用 ・ 軽量 SVG。
 */

const WIDTH = 360;
const HEIGHT = 200;
const PADDING = { top: 12, right: 18, bottom: 28, left: 40 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

export function BodyMetricsChart({
  rows,
  metric,
  metricLabel,
  metricUnit,
  targetWeightKg,
}: {
  rows: BodyMetricRow[];
  metric: MetricKey;
  metricLabel: string;
  metricUnit: string;
  targetWeightKg: number | null;
}) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        date: r.recorded_at,
        value: r[metric],
      })),
    [rows, metric]
  );

  const validValues = data.map((d) => d.value).filter((v): v is number => v !== null);
  const allValues = [
    ...validValues,
    ...(targetWeightKg !== null ? [targetWeightKg] : []),
  ];

  if (allValues.length === 0) {
    return (
      <div className="text-center text-[12px] text-zinc-500 py-10">
        この期間の {metricLabel} 記録はありません
      </div>
    );
  }

  const minV = Math.min(...allValues) - 0.5;
  const maxV = Math.max(...allValues) + 0.5;
  const span = Math.max(maxV - minV, 0.5);

  // 日時 → x 座標
  const t0 = new Date(data[0].date).getTime();
  const tEnd = new Date(data[data.length - 1].date).getTime();
  const tSpan = Math.max(tEnd - t0, 1);

  function xOf(dateStr: string) {
    const t = new Date(dateStr).getTime();
    if (data.length === 1) return PADDING.left + CHART_W / 2;
    return PADDING.left + ((t - t0) / tSpan) * CHART_W;
  }

  function yOf(v: number) {
    return PADDING.top + (1 - (v - minV) / span) * CHART_H;
  }

  const points = data
    .filter((d): d is typeof d & { value: number } => d.value !== null)
    .map((d) => ({ x: xOf(d.date), y: yOf(d.value), v: d.value }));

  const linePath =
    points.length > 0
      ? points
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    value: maxV - t * span,
    y: PADDING.top + t * CHART_H,
  }));

  const xLabelCount = Math.min(5, data.length);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx = Math.floor((i * (data.length - 1)) / Math.max(xLabelCount - 1, 1));
    const d = data[idx];
    const date = new Date(d.date);
    return {
      x: xOf(d.date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
    };
  });

  const targetY = targetWeightKg !== null ? yOf(targetWeightKg) : null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
      {/* グリッド (水平線) */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={PADDING.left}
          x2={PADDING.left + CHART_W}
          y1={t.y}
          y2={t.y}
          stroke="#f3f4f6"
          strokeWidth="1"
          strokeDasharray={i === 4 ? "0" : "2,3"}
        />
      ))}

      {/* Y 軸ラベル */}
      {yTicks.map((t, i) => (
        <text
          key={`y-${i}`}
          x={PADDING.left - 4}
          y={t.y + 3}
          textAnchor="end"
          fill="#00695c"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {t.value.toFixed(1)}
        </text>
      ))}

      {/* 単位ラベル (左上) */}
      <text
        x={PADDING.left - 4}
        y={PADDING.top - 4}
        textAnchor="end"
        fill="#9ca3af"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
      >
        {metricUnit}
      </text>

      {/* 目標線 */}
      {targetY !== null ? (
        <>
          <line
            x1={PADDING.left}
            x2={PADDING.left + CHART_W}
            y1={targetY}
            y2={targetY}
            stroke="#059669"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
          <text
            x={PADDING.left + CHART_W - 2}
            y={targetY - 3}
            textAnchor="end"
            fill="#059669"
            fontSize="9"
            fontWeight="700"
          >
            目標 {targetWeightKg!.toFixed(1)}
          </text>
        </>
      ) : null}

      {/* 折れ線 */}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="#00897b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* データドット */}
      {points.map((p, i) => (
        <circle
          key={`d-${i}`}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="white"
          stroke="#00897b"
          strokeWidth="2"
        />
      ))}

      {/* X 軸ラベル */}
      {xLabels.map((l, i) => (
        <text
          key={`xl-${i}`}
          x={l.x}
          y={HEIGHT - 8}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
