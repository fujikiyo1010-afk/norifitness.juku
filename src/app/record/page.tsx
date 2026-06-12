import Link from "next/link";
import { getLatestBodyMetricSummary } from "@/lib/body-metrics/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ 記録ハブ (/record)
 *
 * 下部タブ「記録」の遷移先。 体組成 + 月次添削 の入口。
 * モック: docs/03_design_mocks/recovered/記録ハブ画面.html (2026-06-09 確定)
 */
export default async function RecordHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/record");

  const summary = await getLatestBodyMetricSummary(user.id);

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <div className="mx-auto max-w-[460px] px-4 py-6">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-zinc-900">記録</h1>
          <p className="text-xs text-zinc-500 mt-1">
            体組成 ・ 月次添削
          </p>
        </header>

        {/* 体組成 カード */}
        <Link
          href="/body-metrics"
          className="block bg-white border border-[#e8ebe9] rounded-2xl p-5 mb-3 hover:border-[#00897b] transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00897b]" />
              体組成
            </h2>
            <span className="text-xs text-[#00695c] font-bold">記録する →</span>
          </div>
          {summary.latest ? (
            <div className="grid grid-cols-3 gap-2 text-center mt-3">
              <SumItem
                label="体重"
                value={summary.latest.weight_kg}
                unit="kg"
              />
              <SumItem
                label="体脂肪"
                value={summary.latest.body_fat_percent}
                unit="%"
              />
              <SumItem
                label="ウエスト"
                value={summary.latest.waist_cm}
                unit="cm"
              />
            </div>
          ) : (
            <div className="text-xs text-zinc-500 mt-1">
              まだ記録がありません
            </div>
          )}
          {summary.daysSinceLatest !== null && (
            <div className="text-[10px] text-zinc-400 mt-2">
              最終記録:{" "}
              {summary.daysSinceLatest === 0
                ? "今日"
                : `${summary.daysSinceLatest} 日前`}
            </div>
          )}
        </Link>

        {/* 体組成 推移グラフ ショートカット */}
        {summary.latest && (
          <Link
            href="/body-metrics/chart"
            className="block bg-white border border-[#e8ebe9] rounded-2xl px-4 py-3 mb-3 text-sm text-[#00695c] font-bold hover:border-[#00897b] transition-colors"
          >
            📈 推移グラフを見る
          </Link>
        )}

        {/* 月次添削 カード */}
        <Link
          href="/monthly-review"
          className="block bg-white border border-[#e8ebe9] rounded-2xl p-5 mb-3 hover:border-[#00897b] transition-colors"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0369a1]" />
              月次添削
            </h2>
            <span className="text-xs text-[#00695c] font-bold">確認する →</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            月 1 回、 17 項目に回答 → のり氏が動画で返信
          </p>
        </Link>
      </div>
    </div>
  );
}

function SumItem({
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
