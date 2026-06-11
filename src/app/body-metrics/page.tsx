import Link from "next/link";
import { listMyBodyMetrics } from "@/lib/body-metrics/queries";
import { BodyMetricsForm } from "./_components/BodyMetricsForm";

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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-5">
          <div className="text-xs text-zinc-500 mb-1">
            <Link href="/" className="hover:underline">
              ホーム
            </Link>
            <span className="mx-1.5 text-zinc-300">/</span>
            <span className="text-zinc-700">体組成</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">体組成 記録</h1>
          <p className="text-xs text-zinc-500 mt-1">
            毎日 or 週 1 で記録 ・ 推移はグラフでチェック
          </p>
        </header>

        {/* 入力フォーム */}
        <BodyMetricsForm
          initialWeight={latest?.weight_kg ?? null}
          initialBodyFat={latest?.body_fat_percent ?? null}
          initialWaist={latest?.waist_cm ?? null}
        />

        {/* 変化を見るリンク */}
        {records.length > 0 && (
          <Link
            href="/body-metrics/chart"
            className="block mt-4 px-4 py-3 bg-white border border-[#e8ebe9] rounded-2xl text-center text-sm font-bold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/5 transition-colors"
          >
            📈 変化を見る (推移グラフ)
          </Link>
        )}

        {/* 履歴 */}
        <section className="mt-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-3">
            最近の記録 ({records.length} 件)
          </h2>
          {records.length === 0 ? (
            <div className="bg-white border border-dashed border-[#e8ebe9] rounded-2xl p-6 text-center">
              <p className="text-sm text-zinc-500">
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
      </div>
    </div>
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
          : "bg-white border-[#e8ebe9]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-zinc-700 font-bold">
          {dateLabel} ({dayLabel})
        </div>
        <div className="text-[10px] text-zinc-500">
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
      <div className="text-[9px] text-zinc-500 mb-0.5">{label}</div>
      <div className="text-base font-bold text-zinc-900 font-mono">
        {value !== null ? value : "—"}
        {value !== null && (
          <span className="text-[10px] text-zinc-500 ml-0.5">{unit}</span>
        )}
      </div>
    </div>
  );
}
