import Link from "next/link";
import { listMyBodyMetrics } from "@/lib/body-metrics/queries";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

type Search = { range?: "6m" | "1y" | "all" };

/**
 * 受講生 ・ 体組成 推移グラフ (/body-metrics/chart)
 *
 * モック: docs/03_design_mocks/recovered/体組成推移グラフ画面.html (案 B 採用)
 *
 * 構成:
 *   - 期間タブ (直近 6 ヶ月 / 1 年 / 全期間)
 *   - 3 グラフ縦並び (体重 / 体脂肪率 / ウエスト)
 *   - 目標達成度ブロック (体重ベース)
 *
 * TODO: 目標達成度 = goal_sheets から目標体重を取得して計算
 */
export default async function BodyMetricsChartPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "6m";
  const all = await listMyBodyMetrics(365);
  const filtered = filterByRange(all, range);

  // 各指標のシリーズ
  const weightSeries = toSeries(filtered, "weight_kg");
  const bodyFatSeries = toSeries(filtered, "body_fat_percent");
  const waistSeries = toSeries(filtered, "waist_cm");

  return (
    <>
      <MemberHeader title="体組成 推移" fallbackHref="/body-metrics" />
      <div className="min-h-screen bg-[#f3ecda]">
        <div className="mx-auto max-w-[460px] px-4 py-6">
        {/* 副題 */}
        <header className="mb-5">
          <div className="text-xs text-[#6a6256] mb-1">
            <span className="text-zinc-700">推移グラフ</span>
          </div>
          <h1 className="text-xl font-bold text-[#2b2620]">体組成 推移</h1>
          <p className="text-xs text-[#6a6256] mt-1">
            体重 ・ 体脂肪率 ・ ウエスト の変化
          </p>
        </header>

        {/* 期間タブ */}
        <div className="flex gap-2 mb-4">
          <RangeTab label="直近 6 ヶ月" range="6m" current={range} />
          <RangeTab label="1 年" range="1y" current={range} />
          <RangeTab label="全期間" range="all" current={range} />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#fffdf8] border border-dashed border-[#e7dcc9] rounded-2xl p-6 text-center">
            <p className="text-sm text-[#6a6256]">
              この期間の記録がありません。
            </p>
            <Link
              href="/body-metrics"
              className="inline-block mt-3 text-xs text-[#34603f] underline"
            >
              ← 記録画面に戻る
            </Link>
          </div>
        ) : (
          <>
            <ChartCard
              title="体重 (kg)"
              dotColor="#4a875b"
              series={weightSeries}
            />
            <ChartCard
              title="体脂肪率 (%)"
              dotColor="#b8860b"
              series={bodyFatSeries}
            />
            <ChartCard
              title="ウエスト (cm)"
              dotColor="#0369a1"
              series={waistSeries}
            />
          </>
        )}
        </div>
      </div>
    </>
  );
}

// =====================================================================
// 期間タブ
// =====================================================================

function RangeTab({
  label,
  range,
  current,
}: {
  label: string;
  range: "6m" | "1y" | "all";
  current: string;
}) {
  const active = current === range;
  const href = range === "6m" ? "/body-metrics/chart" : `/body-metrics/chart?range=${range}`;
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-[#fffdf8] text-zinc-700 border-[#e7dcc9] hover:border-[#4a875b]"
      }`}
    >
      {label}
    </Link>
  );
}

// =====================================================================
// チャートカード
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
      <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-3 py-3 mb-2 text-center text-xs text-[#a59b8c]">
        <span style={{ color: dotColor }}>●</span> {title} ・ 記録なし
      </div>
    );
  }

  const latest = series[series.length - 1];
  const oldest = series[0];
  const delta = Math.round((latest.value - oldest.value) * 10) / 10;
  const deltaSign = delta > 0 ? "+" : "";

  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-3.5 py-2.5 mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2b2620]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: dotColor }}
          />
          {title}
        </div>
        <div className="text-right">
          <div className="text-base font-bold font-mono text-[#2b2620] leading-none">
            {latest.value.toFixed(1)}
          </div>
          {series.length > 1 && (
            <div
              className="text-[9px] font-bold mt-0.5"
              style={{ color: delta <= 0 ? "#4a875b" : "#c2410c" }}
            >
              {deltaSign}
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

function Sparkline({
  series,
  color,
}: {
  series: SeriesPoint[];
  color: string;
}) {
  if (series.length < 2) {
    return (
      <div className="h-[72px] flex items-center justify-center text-[10px] text-[#a59b8c]">
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
    const y =
      h - padBottom - ((p.value - minV) / range) * (h - padTop - padBottom);
    return { x, y };
  });

  const polyline = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-[72px] block"
    >
      <line
        x1="0"
        y1={h - padBottom}
        x2={w}
        y2={h - padBottom}
        stroke="#e7dcc9"
      />
      <line
        x1="0"
        y1={h / 2}
        x2={w}
        y2={h / 2}
        stroke="#e7dcc9"
        strokeDasharray="2 2"
      />
      <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="#e7dcc9" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
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
    <div className="flex justify-between text-[9px] text-[#6a6256] font-mono leading-tight mt-0.5">
      {labels.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

// =====================================================================
// データ加工
// =====================================================================

function filterByRange(
  records: Array<{ recorded_at: string }>,
  range: "6m" | "1y" | "all"
): Array<{ recorded_at: string; weight_kg: number | null; body_fat_percent: number | null; waist_cm: number | null }> {
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
    .map((r) => ({
      date: new Date(r.recorded_at),
      value: r[key] as number,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function pickXLabels(series: SeriesPoint[], n: number): string[] {
  if (series.length === 0) return [];
  if (series.length <= n) {
    return series.map((p) => formatLabel(p.date));
  }
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
