"use client";

import { useMemo, useState } from "react";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import { BodyMetricsChart } from "./BodyMetricsChart";

/**
 * 体組成 詳細カード + 期間タブ + SVG グラフ (2026-06-17 あすけん風リデザイン)
 *
 * 期間タブ: 1週間 / 1ヶ月 / 3ヶ月 / 1年
 * 第 2 軸切替: 体脂肪率 / ウエスト (体重と並列表示)
 * 目標線: 目標シートの target_weight_kg があれば破線で描画
 */

export type SecondaryMetric = "body_fat_percent" | "waist_cm";

const PERIOD_OPTIONS = [
  { key: "1w", label: "1週間", days: 7 },
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "1y", label: "1年", days: 365 },
] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"];

const SECONDARY_OPTIONS: { key: SecondaryMetric; label: string; unit: string }[] = [
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
  const [secondary, setSecondary] = useState<SecondaryMetric>("body_fat_percent");

  const periodDef = PERIOD_OPTIONS.find((p) => p.key === period)!;
  const secondaryDef = SECONDARY_OPTIONS.find((s) => s.key === secondary)!;

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

  const startWeight = startRow?.weight_kg ?? null;
  const currentWeight = latest?.weight_kg ?? null;
  const weightDelta =
    startWeight !== null && currentWeight !== null
      ? Math.round((currentWeight - startWeight) * 10) / 10
      : null;
  const secondaryValue = latest?.[secondary] ?? null;

  const latestDate = latest
    ? new Date(latest.recorded_at).toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "—";

  return (
    <div className="space-y-3">
      {/* メインカード */}
      <div className="bg-white border border-[#e8ebe9] rounded-2xl px-5 py-5">
        <div className="text-center text-[12px] font-bold text-zinc-600 mb-1">
          {latestDate}
        </div>

        <div className="flex items-end justify-center gap-2.5">
          <span className="text-[14px] font-bold text-[#00695c] self-center">
            体重
          </span>
          <span className="text-[40px] font-bold text-zinc-900 leading-none font-mono tracking-tight">
            {currentWeight !== null ? currentWeight.toFixed(1) : "—"}
          </span>
          <span className="text-[14px] font-bold text-zinc-600 leading-none pb-1">
            kg
          </span>
        </div>

        {startRow ? (
          <div className="flex items-center justify-center gap-3 mt-3 text-[12px]">
            <span className="text-zinc-500">
              スタート{" "}
              <span className="font-bold text-zinc-900 font-mono">
                {startWeight !== null ? startWeight.toFixed(1) : "—"}
                <span className="text-[10px] ml-0.5">kg</span>
              </span>
            </span>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-500">
              成果{" "}
              <span
                className={`font-bold font-mono ${
                  weightDelta !== null && weightDelta < 0
                    ? "text-[#00695c]"
                    : weightDelta !== null && weightDelta > 0
                      ? "text-rose-600"
                      : "text-zinc-700"
                }`}
              >
                {weightDelta !== null
                  ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)}`
                  : "—"}
                <span className="text-[10px] ml-0.5">kg</span>
              </span>
            </span>
          </div>
        ) : null}

        {/* 第 2 軸切替 + 値 */}
        <div className="border-t border-[#e8ebe9] mt-4 pt-3 flex items-center justify-between gap-3">
          <SecondarySelector value={secondary} onChange={setSecondary} />
          <div className="text-right">
            <span className="text-[24px] font-bold text-zinc-900 font-mono leading-none">
              {secondaryValue !== null ? secondaryValue.toFixed(1) : "—.—"}
            </span>
            <span className="text-[12px] text-zinc-600 font-bold ml-1">
              {secondaryDef.unit}
            </span>
          </div>
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
            secondary={secondary}
            targetWeightKg={targetWeightKg}
          />
        )}
      </div>
    </div>
  );
}

function SecondarySelector({
  value,
  onChange,
}: {
  value: SecondaryMetric;
  onChange: (next: SecondaryMetric) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {SECONDARY_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
              active
                ? "bg-[#ede9fe] text-[#7c3aed] border border-[#c4b5fd]"
                : "bg-zinc-100 text-zinc-500 border border-transparent hover:bg-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
