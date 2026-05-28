import { getMyToolCalculation } from "@/lib/tools/queries";
import type {
  DietPeriodInputs,
  DietPeriodOutputs,
} from "@/lib/tools/types";
import { DietPeriodToolClient } from "./DietPeriodToolClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "減量期間逆算 | 筋肉塾",
};

/**
 * 減量期間逆算ツール (/tools/diet-period)
 *
 * Server Component: 前回計算結果を取得して Client に渡す。
 * 単独モード = 目標シートとは完全分離。
 */
export default async function DietPeriodToolPage() {
  const previous = await getMyToolCalculation<
    DietPeriodInputs,
    DietPeriodOutputs
  >("diet_period");

  // 開始日のデフォルト = 今日 (前回値があれば前回値)
  const todayISO = new Date().toISOString().slice(0, 10);

  return <DietPeriodToolClient previous={previous} todayISO={todayISO} />;
}
