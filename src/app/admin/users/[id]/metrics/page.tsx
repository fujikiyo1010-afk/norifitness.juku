import Link from "next/link";
import {
  listBodyMetricsForAdmin,
  getLatestBodyMetricSummary,
} from "@/lib/body-metrics/queries";
import { listBodyPhotosForUser } from "@/lib/admin/body-photos";
import { MetricsPhotoSection } from "./MetricsPhotoSection";

export const dynamic = "force-dynamic";

type Search = { range?: "6m" | "1y" | "all" };

/**
 * 管理画面 受講生ハブ ・ 体組成推移タブ
 *
 * モック: docs/03_design_mocks/recovered/体組成推移グラフ画面.html (案 B 採用)
 *
 * 構成: 期間タブ + 3 グラフ縦並び (体重 / 体脂肪率 / ウエスト) + サマリ
 */
export default async function UserMetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id: userId } = await params;
  const sp = await searchParams;
  const range = sp.range ?? "6m";

  const [allRecords, summary, bodyPhotos] = await Promise.all([
    listBodyMetricsForAdmin(userId, 365),
    getLatestBodyMetricSummary(userId),
    listBodyPhotosForUser(userId),
  ]);

  const filtered = filterByRange(allRecords, range);
  const weightSeries = toSeries(filtered, "weight_kg");
  const bodyFatSeries = toSeries(filtered, "body_fat_percent");
  const waistSeries = toSeries(filtered, "waist_cm");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* サマリ (最新 + 7 日変化) */}
      {summary.latest && (
        <div className="bg-white border border-[#e8ebe9] rounded-2xl p-4 mb-4">
          <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-3">
            最新 (
            {summary.daysSinceLatest !== null
              ? `${summary.daysSinceLatest === 0 ? "今日" : `${summary.daysSinceLatest} 日前`}`
              : "—"}
            )
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <SummaryItem
              label="体重 (kg)"
              value={summary.latest.weight_kg}
              delta={summary.weightDelta7d}
            />
            <SummaryItem
              label="体脂肪 (%)"
              value={summary.latest.body_fat_percent}
              delta={summary.bodyFatDelta7d}
            />
            <SummaryItem
              label="ウエスト (cm)"
              value={summary.latest.waist_cm}
              delta={summary.waistDelta7d}
            />
          </div>
        </div>
      )}

      {/* 体型写真(ビフォーアフター + タイムライン)。写真があるときだけ表示 */}
      <MetricsPhotoSection photos={bodyPhotos} />

      {/* 期間タブ */}
      <div className="flex gap-2 mb-4">
        <RangeTab label="直近 6 ヶ月" range="6m" current={range} userId={userId} />
        <RangeTab label="1 年" range="1y" current={range} userId={userId} />
        <RangeTab label="全期間" range="all" current={range} userId={userId} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#e8ebe9] rounded-2xl p-8 text-center">
          <p className="text-sm text-zinc-500">
            この期間の体組成記録がありません
          </p>
          <p className="text-[11px] text-zinc-400 mt-2">
            受講生が <code className="font-mono">/body-metrics</code>{" "}
            から記録するとここに表示されます
          </p>
        </div>
      ) : (
        <>
          <ChartCard title="体重 (kg)" dotColor="#00897b" series={weightSeries} />
          <ChartCard title="体脂肪率 (%)" dotColor="#b8860b" series={bodyFatSeries} />
          <ChartCard title="ウエスト (cm)" dotColor="#0369a1" series={waistSeries} />
        </>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | null;
  delta: number | null;
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-zinc-900 font-mono leading-none">
        {value !== null ? value : "—"}
      </div>
      {delta !== null && (
        <div
          className="text-[10px] font-bold mt-1"
          style={{ color: delta <= 0 ? "#00897b" : "#c2410c" }}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} / 7 日
        </div>
      )}
    </div>
  );
}

function RangeTab({
  label,
  range,
  current,
  userId,
}: {
  label: string;
  range: "6m" | "1y" | "all";
  current: string;
  userId: string;
}) {
  const active = current === range;
  const base = `/admin/users/${userId}/metrics`;
  const href = range === "6m" ? base : `${base}?range=${range}`;
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-[#e8ebe9] hover:border-[#00897b]"
      }`}
    >
      {label}
    </Link>
  );
}

// =====================================================================
// チャート (受講生側 chart/page.tsx と同じ実装)
// =====================================================================

type SeriesPoint = { date: Date; value: number };

function ChartCard({
  title,
  dotColor,
  series,
}: {
  title: string;
  dotColor: string;
  series: SeriesPoint[];
}) {
  if (series.length === 0) {
    return (
      <div className="bg-white border border-[#e8ebe9] rounded-2xl px-3 py-3 mb-2 text-center text-xs text-zinc-400">
        <span style={{ color: dotColor }}>●</span> {title} ・ 記録なし
      </div>
    );
  }
  const latest = series[series.length - 1];
  const oldest = series[0];
  const delta = Math.round((latest.value - oldest.value) * 10) / 10;
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-2xl px-3.5 py-2.5 mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
          <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          {title}
        </div>
        <div className="text-right">
          <div className="text-base font-bold font-mono text-zinc-900 leading-none">
            {latest.value.toFixed(1)}
          </div>
          {series.length > 1 && (
            <div
              className="text-[9px] font-bold mt-0.5"
              style={{ color: delta <= 0 ? "#00897b" : "#c2410c" }}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)} / 期間内
            </div>
          )}
        </div>
      </div>
      <Sparkline series={series} color={dotColor} />
      <XLabels series={series} />
    </div>
  );
}

function Sparkline({ series, color }: { series: SeriesPoint[]; color: string }) {
  if (series.length < 2) {
    return (
      <div className="h-[72px] flex items-center justify-center text-[10px] text-zinc-400">
        2 件以上で線が描かれます
      </div>
    );
  }
  const w = 300;
  const h = 72;
  const padTop = 8;
  const padBottom = 8;
  const values = series.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const firstDate = series[0].date.getTime();
  const lastDate = series[series.length - 1].date.getTime();
  const timeRange = lastDate - firstDate || 1;
  const points = series.map((p) => {
    const x = ((p.date.getTime() - firstDate) / timeRange) * w;
    const y = h - padBottom - ((p.value - minV) / range) * (h - padTop - padBottom);
    return { x, y };
  });
  const polyline = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[72px] block">
      <line x1="0" y1={h - padBottom} x2={w} y2={h - padBottom} stroke="#e8ebe9" />
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#e8ebe9" strokeDasharray="2 2" />
      <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="#e8ebe9" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" />
      {points.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={i === points.length - 1 ? 4 : 3}
          fill={color}
          stroke={i === points.length - 1 ? "white" : "none"}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

function XLabels({ series }: { series: SeriesPoint[] }) {
  if (series.length === 0) return null;
  const labels = pickXLabels(series, 6);
  return (
    <div className="flex justify-between text-[9px] text-zinc-500 font-mono leading-tight mt-0.5">
      {labels.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

function filterByRange(
  records: Array<{ recorded_at: string }>,
  range: "6m" | "1y" | "all"
): Array<{
  recorded_at: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
}> {
  if (range === "all") return records as never;
  const now = new Date();
  const cutoff = new Date(now);
  if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);
  return (records as never[]).filter(
    (r: never) => new Date((r as { recorded_at: string }).recorded_at) >= cutoff
  );
}

function toSeries(
  records: Array<{
    recorded_at: string;
    weight_kg: number | null;
    body_fat_percent: number | null;
    waist_cm: number | null;
  }>,
  key: "weight_kg" | "body_fat_percent" | "waist_cm"
): SeriesPoint[] {
  return records
    .filter((r) => r[key] !== null)
    .map((r) => ({ date: new Date(r.recorded_at), value: r[key] as number }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function pickXLabels(series: SeriesPoint[], n: number): string[] {
  if (series.length === 0) return [];
  if (series.length <= n) return series.map((p) => formatLabel(p.date));
  const step = (series.length - 1) / (n - 1);
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * step);
    labels.push(formatLabel(series[idx].date));
  }
  return labels;
}

function formatLabel(d: Date): string {
  return `${d.getMonth() + 1}月`;
}
