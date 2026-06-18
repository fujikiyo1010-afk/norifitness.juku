import Link from "next/link";
import { listMyBodyMetrics } from "@/lib/body-metrics/queries";
import { BodyMetricsForm } from "./_components/BodyMetricsForm";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ 体組成記録 画面 (/body-metrics)
 *
 * モック: docs/03_design_mocks/recovered/体組成記録画面_v2_(案2-D_ハイブリッド).html
 *
 * 構成:
 *   - 上部: 入力フォーム (体重 / 体脂肪率 / ウエスト / メモ)
 *   - 下部: 最近の記録 (新しい順、 7 日以内は強調)
 *   - 「変化を見る」リンクで /body-metrics/chart へ
 */
export default async function BodyMetricsPage() {
  const records = await listMyBodyMetrics(30);
  const latest = records[0] ?? null;

  return (
    <>
      <MemberHeader title="体組成 記録" fallbackHref="/" />
      <div className="min-h-screen bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-6">
          {/* 副題 (パンくずは AppHeader 戻る矢印で代替) */}
          <p className="text-xs text-[#6a6256] mb-1 mt-1">
            毎日 or 週 1 で記録 ・ 推移はグラフでチェック
          </p>
          <p className="text-xs text-[#6a6256] mb-5">
            リアルタイムで共有されます
          </p>

        {/* 入力フォーム */}
        <BodyMetricsForm
          initialWeight={latest?.weight_kg ?? null}
          initialBodyFat={latest?.body_fat_percent ?? null}
          initialWaist={latest?.waist_cm ?? null}
        />

        {/* 変化を見るリンク → /record (あすけん風グラフが embed されている) */}
        {records.length > 0 && (
          <Link
            href="/record"
            className="flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl text-sm font-bold text-[#34603f] hover:border-[#4a875b] hover:bg-[#4a875b]/5 transition-colors"
          >
            <TrendingUpIcon />
            変化を見る (推移グラフ)
          </Link>
        )}

        {/* 履歴 */}
        <section className="mt-6">
          <h2 className="text-sm font-bold text-[#2b2620] mb-3">
            最近の記録 ({records.length} 件)
          </h2>
          {records.length === 0 ? (
            <div className="bg-[#fffdf8] border border-dashed border-[#e7dcc9] rounded-2xl p-6 text-center">
              <p className="text-sm text-[#6a6256]">
                まだ記録がありません。<br />
                上のフォームから最初の記録をどうぞ。
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {records.map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </ul>
          )}
        </section>

        {/* ホームに戻る */}
        <Link
          href="/"
          className="flex items-center justify-center mt-6 px-4 py-3 bg-[#4a875b] hover:bg-[#34603f] rounded-2xl text-sm font-bold text-white transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
    </>
  );
}

function RecordCard({
  record,
}: {
  record: {
    id: string;
    recorded_at: string;
    weight_kg: number | null;
    body_fat_percent: number | null;
    waist_cm: number | null;
    note: string | null;
  };
}) {
  const date = new Date(record.recorded_at);
  const now = new Date();
  const daysAgo = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isRecent = daysAgo <= 7;
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
  const dayLabel = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];

  return (
    <li
      className={`rounded-2xl border p-3.5 ${
        isRecent
          ? "bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-[#b2dfdb]"
          : "bg-[#fffdf8] border-[#e7dcc9]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-zinc-700 font-bold">
          {dateLabel} ({dayLabel})
        </div>
        <div className="text-[10px] text-[#6a6256]">
          {daysAgo === 0 ? "今日" : `${daysAgo} 日前`}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="体重" value={record.weight_kg} unit="kg" />
        <Metric label="体脂肪" value={record.body_fat_percent} unit="%" />
        <Metric label="ウエスト" value={record.waist_cm} unit="cm" />
      </div>
      {record.note && (
        <div className="mt-2 text-[11px] text-zinc-600 italic leading-relaxed">
          {record.note}
        </div>
      )}
    </li>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div>
      <div className="text-[9px] text-[#6a6256] mb-0.5">{label}</div>
      <div className="text-base font-bold text-[#2b2620] font-mono">
        {value !== null ? value : "—"}
        {value !== null && (
          <span className="text-[10px] text-[#6a6256] ml-0.5">{unit}</span>
        )}
      </div>
    </div>
  );
}

function TrendingUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
