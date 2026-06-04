import { getMyToolCalculation } from "@/lib/tools/queries";
import type {
  CalorieInputs,
  CalorieOutputs,
  PfcCarbInputs,
  PfcCarbOutputs,
} from "@/lib/tools/types";
import { PfcCarbToolClient } from "./PfcCarbToolClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PFC・カーボサイクル設定 | 筋肉塾",
};

/**
 * PFC・カーボサイクル設定 (/tools/pfc-carb)
 *
 * STEP 1 (PFC 計算) + STEP 2 (週次糖質配分) の統合ツール。
 * 単独モード = 目標シートとは完全分離。
 *
 * ツール 2 (必要カロリー計算) の前回値があれば、摂取カロリー欄の
 * 下に「前回計算: メンテ X / ダイエット時 Y」を薄色で目安表示。
 * 自動連携ではなく目安提示のみ (受講生が見て自分で入力する)。
 */
export default async function PfcCarbToolPage() {
  const [previous, caloriePrevious] = await Promise.all([
    getMyToolCalculation<PfcCarbInputs, PfcCarbOutputs>("pfc_carb"),
    getMyToolCalculation<CalorieInputs, CalorieOutputs>("calorie"),
  ]);

  return (
    <PfcCarbToolClient
      previous={previous}
      calorieHint={
        caloriePrevious
          ? {
              maintenance: caloriePrevious.outputs.maintenance,
              diet: caloriePrevious.outputs.diet,
            }
          : null
      }
    />
  );
}
