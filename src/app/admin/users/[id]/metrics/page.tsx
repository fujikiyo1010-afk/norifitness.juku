import Link from "next/link";
import {
  listBodyMetricsForAdmin,
  getLatestBodyMetricSummary,
} from "@/lib/body-metrics/queries";
import { listBodyPhotosForUser } from "@/lib/admin/body-photos";
import { MetricsPhotoSection } from "./MetricsPhotoSection";
import { MetricsCharts, type MetricPoint } from "./MetricsCharts";

export const dynamic = "force-dynamic";

type Search = { range?: "6m" | "1y" | "all" };

type MetricRecord = {
  recorded_at: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
};

/**
 * 管理画面 受講生ハブ ・ 体組成推移タブ
 *
 * 2026-08-25 改修 (のり氏指摘「数値が見えづらい / 何kg痩せたか分からない / 縦長にしたい」):
 *   3グラフ横並び(ぺたんこ・Y軸の数字なし) → 主役1つ+脇役2つの縦長構成へ。
 *   グラフ本体と変化の基準は MetricsCharts.tsx を参照。
 *
 * 構成: サマリ + 体型写真 + 期間タブ + グラフ(主役/脇役)
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
    // 365 = 件数上限。実績の最多は 84 件なので全員「一番最初の記録」まで取れている(2026-08-25 確認)
    listBodyMetricsForAdmin(userId, 365),
    getLatestBodyMetricSummary(userId),
    listBodyPhotosForUser(userId),
  ]);

  const records = allRecords as unknown as MetricRecord[];
  const hasInRange = filterByRange(records, range).length > 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
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

      {!hasInRange ? (
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
        <MetricsCharts
          weight={toPoints(records, "weight_kg")}
          bodyFat={toPoints(records, "body_fat_percent")}
          waist={toPoints(records, "waist_cm")}
          range={range}
        />
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

function filterByRange(records: MetricRecord[], range: "6m" | "1y" | "all"): MetricRecord[] {
  if (range === "all") return records;
  const cutoff = new Date();
  if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);
  return records.filter((r) => new Date(r.recorded_at) >= cutoff);
}

/** 古い順の点列に変換 (期間の絞り込みは表示側で行う ・ 数値は全期間の実績を出すため) */
function toPoints(
  records: MetricRecord[],
  key: "weight_kg" | "body_fat_percent" | "waist_cm"
): MetricPoint[] {
  return records
    .filter((r) => r[key] !== null)
    .map((r) => ({ d: r.recorded_at, v: r[key] as number }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}
