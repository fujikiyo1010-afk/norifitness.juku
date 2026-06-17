"use client";

import { useMemo } from "react";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import type { SecondaryMetric } from "./BodyMetricsHero";

/**
 * 体組成 折れ線グラフ ・ SVG 自前実装 (あすけん風)
 *
 * 描画要素:
 *   - 左軸: 体重 kg (緑 ・ ティール緑 #00897b)
 *   - 右軸: 体脂肪率 % or ウエスト cm (紫 #7c3aed)
 *   - 目標線: target_weight_kg があれば緑破線
 *   - データドット: 記録日に丸
 *   - X 軸: 日付ラベル (4-5 個ピッチ)
 *
 * ライブラリ不採用 ・ 50-80 行で完結。
 */

const WIDTH = 360;
const HEIGHT = 200;
const PADDING = { top: 12, right: 36, bottom: 28, left: 36 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

export function BodyMetricsChart({
  rows,
  secondary,
  targetWeightKg,
}: {
  rows: BodyMetricRow[];
  secondary: SecondaryMetric;
  targetWeightKg: number | null;
}) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        date: r.recorded_at,
        primary: r.weight_kg,
        secondary: r[secondary],
      })),
    [rows, secondary]
  );

  // 値域計算 (1 点だけならパディング、 全部 null なら表示しない)
  const primaryValues = data.map((d) => d.primary).filter((v): v is number => v !== null);
  const secondaryValues = data.map((d) => d.secondary).filter((v): v is number => v !== null);

  // 目標線も値域に含めて Y 軸を伸ばす
  const allPrimary = [...primaryValues, ...(targetWeightKg !== null ? [targetWeightKg] : [])];
  if (allPrimary.length === 0) {
    return (
      <div className="text-center text-[12px] text-zinc-500 py-10">
        まだデータがありません
      </div>
    );
  }

  const pMin = Math.min(...allPrimary) - 0.5;
  const pMax = Math.max(...allPrimary) + 0.5;
  const pSpan = Math.max(pMax - pMin, 0.5);

  const hasSec = secondaryValues.length > 0;
  const sMin = hasSec ? Math.min(...secondaryValues) - 0.3 : 0;
  const sMax = hasSec ? Math.max(...secondaryValues) + 0.3 : 1;
  const sSpan = Math.max(sMax - sMin, 0.5);

  // 日時 → x 座標 (時系列均等割り or 日数比)
  const t0 = new Date(data[0].date).getTime();
  const tEnd = new Date(data[data.length - 1].date).getTime();
  const tSpan = Math.max(tEnd - t0, 1);

  function xOf(dateStr: string) {
    const t = new Date(dateStr).getTime();
    if (data.length === 1) return PADDING.left + CHART_W / 2;
    return PADDING.left + ((t - t0) / tSpan) * CHART_W;
  }

  function yPrimary(v: number) {
    return PADDING.top + (1 - (v - pMin) / pSpan) * CHART_H;
  }

  function ySecondary(v: number) {
    return PADDING.top + (1 - (v - sMin) / sSpan) * CHART_H;
  }

  const primaryPoints = data
    .filter((d): d is typeof d & { primary: number } => d.primary !== null)
    .map((d) => ({ x: xOf(d.date), y: yPrimary(d.primary), v: d.primary }));
  const secondaryPoints = data
    .filter((d): d is typeof d & { secondary: number } => d.secondary !== null)
    .map((d) => ({ x: xOf(d.date), y: ySecondary(d.secondary), v: d.secondary }));

  const primaryPath =
    primaryPoints.length > 0
      ? primaryPoints
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")
      : "";
  const secondaryPath =
    secondaryPoints.length > 0
      ? secondaryPoints
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")
      : "";

  // Y 軸ラベル (5 点等分割)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    primary: pMax - t * pSpan,
    secondary: sMax - t * sSpan,
    y: PADDING.top + t * CHART_H,
  }));

  // X 軸ラベル (4-5 点)
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

  const targetY = targetWeightKg !== null ? yPrimary(targetWeightKg) : null;

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

      {/* Y 軸ラベル (左 = 体重) */}
      {yTicks.map((t, i) => (
        <text
          key={`yl-${i}`}
          x={PADDING.left - 4}
          y={t.y + 3}
          textAnchor="end"
          fill="#00695c"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {t.primary.toFixed(1)}
        </text>
      ))}

      {/* Y 軸ラベル (右 = 第 2 軸) */}
      {hasSec &&
        yTicks.map((t, i) => (
          <text
            key={`yr-${i}`}
            x={PADDING.left + CHART_W + 4}
            y={t.y + 3}
            textAnchor="start"
            fill="#7c3aed"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
          >
            {t.secondary.toFixed(1)}
          </text>
        ))}

      {/* 目標線 (緑破線) */}
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

      {/* 第 2 軸ライン (背面) */}
      {secondaryPath ? (
        <path
          d={secondaryPath}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* 主軸ライン (体重 ・ 前面) */}
      {primaryPath ? (
        <path
          d={primaryPath}
          fill="none"
          stroke="#00897b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* 第 2 軸ドット */}
      {secondaryPoints.map((p, i) => (
        <circle key={`sd-${i}`} cx={p.x} cy={p.y} r="2.5" fill="#7c3aed" />
      ))}

      {/* 主軸ドット */}
      {primaryPoints.map((p, i) => (
        <circle
          key={`pd-${i}`}
          cx={p.x}
          cy={p.y}
          r="3.25"
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
