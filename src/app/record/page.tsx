import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/MemberHeader";
import { createClient } from "@/lib/supabase/server";
import { listMyBodyMetrics } from "@/lib/body-metrics/queries";
import { getMyBodyPhotoSummary } from "@/lib/body-photos/queries";
import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { BodyMetricsDetail } from "./BodyMetricsDetail";

export const dynamic = "force-dynamic";

/**
 * 受講生 ・ 記録ハブ (/record) ・ 2026-06-17 あすけん風リデザイン
 *
 * 設計変更:
 *   - 月次添削ブロック削除 (= 下部ナビ「月次添削」 タブに独立)
 *   - 体組成カードをあすけん UI に寄せた詳細版に
 *   - 「推移グラフを見る」 別画面遷移 → 同一画面に embed (SVG 自前折れ線)
 *   - 目標シートの target_weight_kg を目標線として表示
 *
 * モック: スクショ参考 (あすけん 体重グラフ画面) ・ ティール緑化
 */
export default async function RecordHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/record");

  const [rows, goalSheet, photoSummary] = await Promise.all([
    listMyBodyMetrics(365),
    getMyGoalSheet(),
    getMyBodyPhotoSummary(),
  ]);

  // 古い順に並べ替え (グラフ描画は時系列 ascending が自然)
  const sorted = [...rows].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at)
  );

  const targetWeightKg =
    (goalSheet?.content?.goal_selection as { target_weight_kg?: number } | undefined)
      ?.target_weight_kg ?? null;

  return (
    <>
      <MemberHeader title="記録" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4 space-y-4">
          <BodyMetricsDetail
            rows={sorted}
            targetWeightKg={targetWeightKg}
            photoSummary={photoSummary}
          />
        </div>
      </main>
    </>
  );
}
