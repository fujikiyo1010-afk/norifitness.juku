"use client";

import { useMemo, useState } from "react";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import { BodyMetricsChart } from "./BodyMetricsChart";

/**
 * 体組成 詳細カード + 期間タブ + SVG グラフ (2026-06-17 あすけん風リデザイン v2)
 *
 * きよむさん指示 (2026-06-17):
 *   - 用語: スタート→入会時 / 成果→変化
 *   - 主軸切替: 体重 / 体脂肪率 / ウエスト の 3-way 単一選択
 *     (旧第 2 軸切替は撤回 ・ 選んだものをメインで大表示 + グラフも 1 本)
 */

export type MetricKey = "weight_kg" | "body_fat_percent" | "waist_cm";

const PERIOD_OPTIONS = [
  { key: "1w", label: "1週間", days: 7 },
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "1y", label: "1年", days: 365 },
] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"];

const METRIC_OPTIONS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weight_kg", label: "体重", unit: "kg" },
  { key: "body_fat_percent", label: "体脂肪率", unit: "%" },
  { key: "waist_cm", label: "ウエスト", unit: "cm" },
];

export function BodyMetricsHero({
  rows,
  targetWeightKg,
}: {
  rows: BodyMetricRow[];
  targetWeightKg: number | null;
}) {
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const [metric, setMetric] = useState<MetricKey>("weight_kg");

  const periodDef = PERIOD_OPTIONS.find((p) => p.key === period)!;
  const metricDef = METRIC_OPTIONS.find((m) => m.key === metric)!;

  // 期間 filter (recorded_at から逆算)
  const filtered = useMemo(() => {
    if (rows.length === 0) return rows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDef.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return rows.filter((r) => r.recorded_at >= cutoffStr);
  }, [rows, periodDef.days]);

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const startRow = rows.length > 0 ? rows[0] : null;

  const startValue = startRow?.[metric] ?? null;
  const currentValue = latest?.[metric] ?? null;
  const delta =
    startValue !== null && currentValue !== null
      ? Math.round((currentValue - startValue) * 10) / 10
      : null;

  const latestDate = latest
    ? new Date(latest.recorded_at).toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "—";

  // 体重以外を選択中は目標線非表示 (= 目標シートは体重のみ管理)
  const targetForChart = metric === "weight_kg" ? targetWeightKg : null;

  return (
    <div className="space-y-3">
      {/* メインカード */}
      <div className="bg-white border border-[#e8ebe9] rounded-2xl px-5 py-5">
        <div className="text-center text-[12px] font-bold text-zinc-600 mb-1">
          {latestDate}
        </div>

        <div className="flex items-end justify-center gap-2.5">
          <span className="text-[14px] font-bold text-[#00695c] self-center">
            {metricDef.label}
          </span>
          <span className="text-[40px] font-bold text-zinc-900 leading-none font-mono tracking-tight">
            {currentValue !== null ? currentValue.toFixed(1) : "—"}
          </span>
          <span className="text-[14px] font-bold text-zinc-600 leading-none pb-1">
            {metricDef.unit}
          </span>
        </div>

        {startRow ? (
          <div className="flex items-center justify-center gap-3 mt-3 text-[12px]">
            <span className="text-zinc-500">
              入会時{" "}
              <span className="font-bold text-zinc-900 font-mono">
                {startValue !== null ? startValue.toFixed(1) : "—"}
                <span className="text-[10px] ml-0.5">{metricDef.unit}</span>
              </span>
            </span>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-500">
              変化{" "}
              <span
                className={`font-bold font-mono ${
                  delta !== null && delta < 0
                    ? "text-[#00695c]"
                    : delta !== null && delta > 0
                      ? "text-rose-600"
                      : "text-zinc-700"
                }`}
              >
                {delta !== null
                  ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`
                  : "—"}
                <span className="text-[10px] ml-0.5">{metricDef.unit}</span>
              </span>
            </span>
          </div>
        ) : null}

        {/* 主軸 3-way 切替 */}
        <div className="border-t border-[#e8ebe9] mt-4 pt-3">
          <MetricSelector value={metric} onChange={setMetric} />
        </div>
      </div>

      {/* 期間タブ */}
      <div className="flex gap-1.5">
        {PERIOD_OPTIONS.map((opt) => {
          const active = opt.key === period;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={`flex-1 px-2 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                active
                  ? "bg-[#00695c] text-white"
                  : "bg-white border border-[#e8ebe9] text-zinc-700 hover:border-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* グラフ */}
      <div className="bg-white border border-[#e8ebe9] rounded-2xl px-3 pt-4 pb-3">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-zinc-500">
            この期間の記録はまだありません
          </div>
        ) : (
          <BodyMetricsChart
            rows={filtered}
            metric={metric}
            metricLabel={metricDef.label}
            metricUnit={metricDef.unit}
            targetWeightKg={targetForChart}
          />
        )}
      </div>
    </div>
  );
}

function MetricSelector({
  value,
  onChange,
}: {
  value: MetricKey;
  onChange: (next: MetricKey) => void;
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {METRIC_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`flex-1 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              active
                ? "bg-[#00695c] text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
