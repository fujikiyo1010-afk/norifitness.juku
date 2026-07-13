"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import { BodyMetricsChart, type MetricKey } from "@/app/record/BodyMetricsChart";
import { getUserBodyMetricsForDaily } from "./body-actions";

/**
 * まとめパネル・体組成タブ(2026-07-13・件2): デイリー添削の2番目タブ。
 * 受講生側 BodyMetricsChart(目標線あり・クライアント)を流用。指標(体重/体脂肪/ウエスト)切替＋
 * 期間チップ(1ヶ月/3ヶ月/全期間)＋最近の記録＋空状態。タブを開いた時だけ体組成履歴を遅延取得。
 * 管理のみ(段1)。next/dynamic(ssr:false)で包み、初回クリック時のみチャンク取得。
 */

type Range = "1m" | "3m" | "all";
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "all", label: "全期間", days: null },
];
const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weight_kg", label: "体重", unit: "kg" },
  { key: "body_fat_percent", label: "体脂肪", unit: "%" },
  { key: "waist_cm", label: "ウエスト", unit: "cm" },
];

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
    active
      ? "bg-[#00897b] text-white"
      : "bg-white border border-[#e8ebe9] text-zinc-500 hover:text-zinc-800"
  }`;
}
function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export default function BodyTab({
  userId,
  targetWeightKg,
}: {
  userId: string;
  targetWeightKg: number | null;
}) {
  const [rows, setRows] = useState<BodyMetricRow[] | null>(null);
  const [metric, setMetric] = useState<MetricKey>("weight_kg");
  const [range, setRange] = useState<Range>("3m");

  useEffect(() => {
    let alive = true;
    getUserBodyMetricsForDaily(userId)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (rows === null) {
    return (
      <div className="py-10 text-center text-[12px] text-zinc-400">読み込み中…</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e8ebe9] bg-[#fafbfb] p-6 text-center text-[12px] text-zinc-500">
        体組成の記録はまだありません。
        <Link
          href={`/admin/users/${userId}/metrics`}
          className="ml-1 font-bold text-[#00897b] hover:underline"
        >
          受講生ハブへ →
        </Link>
      </div>
    );
  }

  // rows は新しい順。グラフは古→新で欲しいので昇順に。
  const asc = [...rows].reverse();
  const latest = new Date(asc[asc.length - 1].recorded_at).getTime();
  const cur = RANGES.find((r) => r.key === range) ?? RANGES[1];
  const filtered =
    cur.days == null
      ? asc
      : asc.filter(
          (r) => new Date(r.recorded_at).getTime() >= latest - cur.days! * 86_400_000
        );

  const hasData = (m: MetricKey) => rows.some((r) => r[m] != null);
  const availMetrics = METRICS.filter((m) => hasData(m.key));
  const curMeta = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const recent = rows.slice(0, 5); // 最近の記録(新しい順)

  return (
    <div className="space-y-3">
      {/* 指標チップ(データのある指標のみ) */}
      {availMetrics.length > 1 && (
        <div className="flex gap-1.5">
          {availMetrics.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={chipClass(metric === m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* グラフ(体重選択時のみ目標体重の緑破線) */}
      <div className="rounded-xl border border-[#e8ebe9] bg-white p-3">
        <BodyMetricsChart
          rows={filtered}
          metric={metric}
          metricLabel={curMeta.label}
          metricUnit={curMeta.unit}
          targetWeightKg={metric === "weight_kg" ? targetWeightKg : null}
        />
      </div>

      {/* 期間チップ */}
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={chipClass(range === r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 最近の記録 */}
      <div>
        <div className="mb-1 text-[11px] font-bold text-zinc-500">最近の記録</div>
        <div className="divide-y divide-[#f0f0ee] rounded-lg border border-[#e8ebe9]">
          {recent.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-3 py-1.5 text-[12px]"
            >
              <span className="font-mono text-zinc-500">{mdLabel(r.recorded_at)}</span>
              <span className="flex gap-3">
                {r.weight_kg != null && <span className="font-bold">{r.weight_kg}kg</span>}
                {r.body_fat_percent != null && (
                  <span className="text-zinc-500">体脂肪 {r.body_fat_percent}%</span>
                )}
                {r.waist_cm != null && (
                  <span className="text-zinc-500">W {r.waist_cm}cm</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
